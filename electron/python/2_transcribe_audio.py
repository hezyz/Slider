import whisper
import json
import os
import sys
import warnings
import torch
import gc
from pydub import AudioSegment
import tempfile
import shutil

def log_status(status, message):
    status_data = {
        "type": "status",
        "status": status,
        "message": message
    }
    print(f"STATUS:{json.dumps(status_data)}", flush=True)

def log_progress(percent):
    progress_data = {
        "type": "progress",
        "percent": percent
    }
    print(f"PROGRESS:{json.dumps(progress_data)}", flush=True)

def force_garbage_collection():
    """Aggressive garbage collection and memory cleanup"""
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        torch.cuda.synchronize()

def get_audio_duration(audio_path):
    """Get audio duration in seconds"""
    try:
        audio = AudioSegment.from_file(audio_path)
        duration = len(audio) / 1000.0  # Convert to seconds
        del audio  # Explicitly delete to free memory
        force_garbage_collection()
        return duration
    except Exception as e:
        log_status("error", f"Could not get audio duration: {str(e)}")
        return 0

def split_audio_into_chunks(audio_path, max_chunk_minutes=3):
    """Split audio into chunks of maximum 3 minutes each"""
    try:
        log_status("info", "Loading audio file for splitting...")
        audio = AudioSegment.from_file(audio_path)
        
        total_duration_minutes = len(audio) / (1000 * 60)  # Total duration in minutes
        max_chunk_ms = max_chunk_minutes * 60 * 1000  # 3 minutes in milliseconds
        
        log_status("info", f"Total audio duration: {total_duration_minutes:.1f} minutes")
        
        chunks = []
        chunk_count = 0
        
        # Split into 3-minute chunks
        for i in range(0, len(audio), max_chunk_ms):
            chunk = audio[i:i + max_chunk_ms]
            chunk_duration_minutes = len(chunk) / (1000 * 60)
            chunks.append(chunk)
            chunk_count += 1
            
            log_status("info", f"Created chunk {chunk_count}: {chunk_duration_minutes:.1f} minutes")
            
            # Force cleanup every few chunks
            if chunk_count % 3 == 0:
                force_garbage_collection()
        
        log_status("info", f"Split into {len(chunks)} chunks of max {max_chunk_minutes} minutes each")
        
        del audio  # Delete original audio from memory
        force_garbage_collection()
        return chunks
    except Exception as e:
        log_status("error", f"Could not split audio: {str(e)}")
        return []

def transcribe_chunk_with_retry(model, chunk_path, language, time_offset, max_retries=2):
    """Transcribe a chunk with retry logic and memory cleanup"""
    for attempt in range(max_retries + 1):
        try:
            # Force cleanup before each attempt
            force_garbage_collection()
            
            # Redirect stderr to suppress Whisper's internal output
            original_stderr = sys.stderr
            sys.stderr = open(os.devnull, 'w')
            
            # Use minimal settings for memory efficiency
            result = model.transcribe(
                chunk_path, 
                language=language, 
                word_timestamps=False,  # Disable word timestamps to save memory
                verbose=False,
                temperature=0.0,
                best_of=1,
                beam_size=1,
                patience=1.0,
                length_penalty=1.0,
                suppress_tokens=[-1],
                initial_prompt=None,
                condition_on_previous_text=False,  # Disable to save memory
                fp16=True,  # Use FP16 for memory efficiency
                compression_ratio_threshold=2.4,
                logprob_threshold=-1.0,
                no_speech_threshold=0.6
            )
            
            # Restore stderr
            sys.stderr.close()
            sys.stderr = original_stderr
            
            # Adjust timestamps with offset
            segments = result['segments']
            for seg in segments:
                if time_offset > 0:
                    seg['start'] += time_offset
                    seg['end'] += time_offset
            
            # Force cleanup after successful transcription
            del result
            force_garbage_collection()
            
            return segments
            
        except Exception as e:
            # Restore stderr in case of error
            sys.stderr = original_stderr
            
            if attempt < max_retries:
                log_status("info", f"Transcription attempt {attempt + 1} failed, retrying... ({str(e)})")
                force_garbage_collection()
                continue
            else:
                raise e

def transcribe_audio(audio_path, output_path, corrections_json=None, language="he", model_size="medium"):
    if not os.path.exists(audio_path):
        log_status("error", f"Audio file does not exist: {audio_path}")
        sys.exit(1)

    # Create output directory if it doesn't exist
    output_dir = os.path.dirname(output_path)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # Check audio duration and determine strategy
    duration = get_audio_duration(audio_path)
    log_status("info", f"Audio duration: {duration:.2f} seconds ({duration/60:.2f} minutes)")
    
    # Always split for files longer than 3 minutes
    should_split = duration > 180  # Split if longer than 3 minutes
    
    if should_split:
        estimated_chunks = int((duration / 60) / 3) + 1  # Estimate number of 3-minute chunks
        log_status("info", f"Audio will be split into approximately {estimated_chunks} chunks of 3 minutes each")
    
    # Recommend smaller model for very long files
    if duration > 900:  # 15 minutes
        log_status("info", f"Very long file detected ({duration/60:.1f} min). Strongly recommend using 'tiny' or 'base' model.")
    elif duration > 600:  # 10 minutes
        log_status("info", f"Long file detected ({duration/60:.1f} min). Consider using 'base' model for better memory management.")
    
    log_status("info", "Loading Whisper model...")
    log_progress(5)
    
    try:
        # Suppress warnings to reduce noise
        warnings.filterwarnings("ignore", category=UserWarning)
        
        # Load Whisper model with memory optimization
        model = whisper.load_model(model_size)
        log_status("info", f"Loaded Whisper model: {model_size}")
        log_progress(10)
        
        # Force cleanup after loading model
        force_garbage_collection()
        
        all_segments = []
        
        if should_split:
            log_status("info", "Audio is longer than 3 minutes, splitting into 3-minute chunks...")
            chunks = split_audio_into_chunks(audio_path, max_chunk_minutes=3)
            log_status("info", f"Created {len(chunks)} chunks for processing")
            
            # Create temporary directory for chunks
            temp_dir = tempfile.mkdtemp()
            
            try:
                for i, chunk in enumerate(chunks):
                    chunk_path = os.path.join(temp_dir, f"chunk_{i:03d}.wav")
                    
                    # Export chunk to file with optimized settings
                    chunk.export(
                        chunk_path, 
                        format="wav", 
                        parameters=["-ar", "16000", "-ac", "1", "-acodec", "pcm_s16le"]
                    )
                    
                    chunk_duration = len(chunk) / (1000 * 60)  # Duration in minutes
                    log_status("info", f"Processing chunk {i+1}/{len(chunks)} ({chunk_duration:.1f} min)")
                    
                    # Calculate time offset for this chunk (3 minutes per chunk)
                    time_offset = i * 3 * 60  # 3 minutes per chunk in seconds
                    
                    # Transcribe chunk with retry
                    try:
                        chunk_result = transcribe_chunk_with_retry(model, chunk_path, language, time_offset)
                        all_segments.extend(chunk_result)
                        log_status("info", f"Chunk {i+1} completed successfully")
                    except Exception as e:
                        log_status("error", f"Failed to transcribe chunk {i+1}: {str(e)}")
                        # Continue with next chunk instead of failing completely
                        continue
                    
                    # Update progress
                    progress = 10 + int((i + 1) / len(chunks) * 70)
                    log_progress(progress)
                    
                    # Clean up chunk from memory and disk immediately
                    del chunk
                    if os.path.exists(chunk_path):
                        os.remove(chunk_path)
                    force_garbage_collection()
                    
            finally:
                # Clean up temporary directory
                shutil.rmtree(temp_dir, ignore_errors=True)
                
        else:
            # Process entire audio file at once for shorter files
            log_status("info", "Processing entire audio file...")
            try:
                all_segments = transcribe_chunk_with_retry(model, audio_path, language, time_offset=0)
            except Exception as e:
                log_status("error", f"Transcription failed: {str(e)}")
                sys.exit(1)
            log_progress(80)
        
        # Clean up model from memory
        del model
        force_garbage_collection()
        
        log_progress(85)
        log_status("info", "Processing transcription results...")
        
        # Filter and clean segments
        output = []
        for seg in all_segments:
            text = seg['text'].strip()
            if text and len(text) > 1:  # Only add non-empty text with more than 1 character
                output.append({
                    "text": text,
                    "start": seg.get('start', 0),
                    "end": seg.get('end', 0)
                })
        
        log_progress(90)
        
        # Apply corrections if provided
        if corrections_json:
            try:
                corrections = json.loads(corrections_json)
                log_status("info", f"Applying {len(corrections)} corrections...")
                
                for seg in output:
                    for wrong, correct in corrections.items():
                        seg["text"] = seg["text"].replace(wrong, correct)
                        
            except json.JSONDecodeError:
                log_status("error", "Invalid corrections JSON format")
                sys.exit(1)
        
        log_progress(95)
        
        # Save to JSON
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False, indent=2)
        
        log_progress(100)
        log_status("success", f"Transcription completed successfully! Processed {duration/60:.2f} minutes, saved {len(output)} segments to {os.path.basename(output_path)}")
        
    except Exception as e:
        log_status("error", f"Transcription failed: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        log_status("error", "Usage: python transcribe_audio.py <audio_file> <output_file> [corrections_json] [language] [model_size]")
        sys.exit(1)

    audio_path = sys.argv[1]
    output_path = sys.argv[2]
    corrections_json = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] != "null" else None
    language = sys.argv[4] if len(sys.argv) > 4 else "he"
    model_size = sys.argv[5] if len(sys.argv) > 5 else "medium"
    
    log_status("info", f"Audio: {os.path.basename(audio_path)}")
    log_status("info", f"Output: {os.path.basename(output_path)}")
    log_status("info", f"Language: {language}")
    log_status("info", f"Model: {model_size}")
    
    transcribe_audio(audio_path, output_path, corrections_json, language, model_size)