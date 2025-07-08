import os
import sys
import subprocess
import re
import json

def log(msg):
    print(msg)
    sys.stdout.flush()

def log_progress(percent):
    # Send structured progress data
    progress_data = {
        "type": "progress",
        "percent": percent
    }
    print(f"PROGRESS:{json.dumps(progress_data)}")
    sys.stdout.flush()

def log_status(status, message):
    status_data = {
        "type": "status",
        "status": status,
        "message": message
    }
    print(f"STATUS:{json.dumps(status_data)}")
    sys.stdout.flush()

def extract_audio(input_path, output_path):
    if not os.path.exists(input_path):
        log_status("error", f"Input file does not exist: {input_path}")
        sys.exit(1)

    # Create output directory if it doesn't exist
    output_dir = os.path.dirname(output_path)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir)

    log_status("info", "Starting audio extraction...")

    command = [
        "ffmpeg",
        "-y",  # Overwrite output file
        "-i", input_path,
        "-vn",  # No video
        "-acodec", "pcm_s16le",  # Audio codec
        "-ar", "16000",  # Sample rate
        "-ac", "1",  # Mono
        output_path
    ]

    try:
        process = subprocess.Popen(
            command,
            stderr=subprocess.PIPE,
            stdout=subprocess.DEVNULL,
            text=True,
            bufsize=1
        )

        duration = None
        time_pattern = re.compile(r'time=(\d+):(\d+):(\d+)\.(\d+)')
        duration_pattern = re.compile(r'Duration: (\d+):(\d+):(\d+)\.(\d+)')

        for line in process.stderr:
            line = line.strip()

            # Extract total duration once
            if duration is None:
                match = duration_pattern.search(line)
                if match:
                    h, m, s, ms = map(int, match.groups())
                    duration = h * 3600 + m * 60 + s + ms / 100
                    log_status("info", f"Duration: {duration:.2f} seconds")
                    continue

            # Extract current time and calculate progress
            if duration:
                match = time_pattern.search(line)
                if match:
                    h, m, s, ms = map(int, match.groups())
                    current = h * 3600 + m * 60 + s + ms / 100
                    percent = min(int((current / duration) * 100), 100)
                    log_progress(percent)

        process.wait()

        if process.returncode != 0:
            log_status("error", "ffmpeg failed to extract audio")
            sys.exit(1)

        # Verify output file exists
        if not os.path.exists(output_path):
            log_status("error", "Output file was not created")
            sys.exit(1)

        file_size = os.path.getsize(output_path)
        log_status("success", f"Audio extracted successfully! Output size: {file_size} bytes")
        log_progress(100)

    except FileNotFoundError:
        log_status("error", "ffmpeg not found. Please install ffmpeg and add it to your PATH")
        sys.exit(1)
    except Exception as e:
        log_status("error", f"Unexpected error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) != 3:
        log_status("error", "Usage: python extract_audio.py <input_video> <output_audio>")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]
    
    log_status("info", f"Input: {input_path}")
    log_status("info", f"Output: {output_path}")
    
    extract_audio(input_path, output_path)