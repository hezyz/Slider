import json
import sys
import os
from openai import OpenAI

def log_status(status, message):
    """Log status messages that can be captured by Electron"""
    status_data = {
        "type": "status",
        "status": status,
        "message": message
    }
    print(f"STATUS:{json.dumps(status_data)}", flush=True)

def translate_segments(input_file, output_file, api_key, system_prompt, source_lang="he", target_lang="en", model="gpt-4"):
    """Translate segments using OpenAI API"""
    
    try:
        # Initialize OpenAI client
        if not api_key or api_key.strip() == "":
            log_status("error", "OpenAI API key is required")
            return False
            
        client = OpenAI(api_key=api_key.strip())
        
        # Check if input file exists
        if not os.path.exists(input_file):
            log_status("error", f"Input file does not exist: {input_file}")
            return False
        
        # Load segments
        log_status("info", f"Loading segments from {os.path.basename(input_file)}")
        with open(input_file, "r", encoding="utf-8") as f:
            segments = json.load(f)
        
        if not isinstance(segments, list):
            log_status("error", "Input file must contain a JSON array of segments")
            return False
            
        log_status("info", f"Found {len(segments)} segments to process")
        
        # Ensure output directory exists
        output_dir = os.path.dirname(output_file)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)
        
        # Process each segment and create new output format
        translated_segments = []
        translated_count = 0
        error_count = 0
        
        for i, seg in enumerate(segments):
            # Progress update
            progress_percent = int((i / len(segments)) * 100)
            log_status("progress", f"Translating segment {i+1}/{len(segments)} ({progress_percent}%)")
            
            source_text = seg.get("text", "").strip()
            
            # Skip empty segments
            if not source_text:
                log_status("info", f"Segment {i+1}: Skipped empty segment")
                continue
            
            # Create new segment with required output format
            new_segment = {
                "id": i + 1,  # Start from 1 instead of 0
                "text": source_text,
                "translation": "",  # Will be filled by translation
                "slide": 1,  # Default slide number
                "delayStartSeconds": 0,
                "delayEndSeconds": 0
            }
            
            # Translate using OpenAI
            try:
                response = client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": source_text}
                    ],
                    temperature=0.3,  # Lower temperature for more consistent translations
                    max_tokens=500    # Reasonable limit for segment translations
                )
                
                translation = response.choices[0].message.content.strip()
                new_segment["translation"] = translation
                translated_count += 1
                
                log_status("info", f"Segment {i+1}: '{source_text[:50]}...' → '{translation[:50]}...'")
                
            except Exception as e:
                new_segment["translation"] = "[translation_error]"
                error_count += 1
                log_status("error", f"Segment {i+1}: Translation failed - {str(e)}")
            
            # Add the new segment to output
            translated_segments.append(new_segment)
        
        # Save translated segments in new format
        log_status("info", f"Saving translations to {os.path.basename(output_file)}")
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(translated_segments, f, ensure_ascii=False, indent=2)
        
        # Final status
        if error_count > 0:
            log_status("warning", f"Translation completed with {error_count} errors. {translated_count} segments translated successfully.")
        else:
            log_status("success", f"All {translated_count} segments translated successfully!")
        
        return True
        
    except Exception as e:
        log_status("error", f"Translation process failed: {str(e)}")
        return False

def main():
    """Main function that processes command line arguments"""
    
    if len(sys.argv) < 6:
        log_status("error", "Usage: python translate.py <input_file> <output_file> <api_key> <system_prompt> <source_lang> [target_lang] [model]")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    api_key = sys.argv[3]
    system_prompt = sys.argv[4]
    source_lang = sys.argv[5]
    target_lang = sys.argv[6] if len(sys.argv) > 6 else "en"
    model = sys.argv[7] if len(sys.argv) > 7 else "gpt-4"
    
    log_status("info", f"Starting translation: {source_lang} → {target_lang}")
    log_status("info", f"Model: {model}")
    log_status("info", f"Input: {os.path.basename(input_file)}")
    log_status("info", f"Output: {os.path.basename(output_file)}")
    
    success = translate_segments(
        input_file=input_file,
        output_file=output_file,
        api_key=api_key,
        system_prompt=system_prompt,
        source_lang=source_lang,
        target_lang=target_lang,
        model=model
    )
    
    if not success:
        sys.exit(1)

if __name__ == "__main__":
    main()