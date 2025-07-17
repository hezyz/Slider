import json
import sys
import os

def log_status(status, message):
    status_data = {
        "type": "status",
        "status": status,
        "message": message
    }
    print(f"STATUS:{json.dumps(status_data)}", flush=True)

def apply_corrections_to_json(json_file_path, corrections_json, output_path=None):
    """Apply text corrections to an existing transcription JSON file"""
    
    # Use same file if no output path specified
    if output_path is None:
        output_path = json_file_path
    
    try:
        # Read the existing transcription JSON
        if not os.path.exists(json_file_path):
            log_status("error", f"Transcription file does not exist: {json_file_path}")
            return False
        
        with open(json_file_path, 'r', encoding='utf-8') as f:
            segments = json.load(f)
        
        log_status("info", f"Loaded {len(segments)} segments from {os.path.basename(json_file_path)}")
        
        # Parse corrections
        if not corrections_json or not corrections_json.strip():
            log_status("info", "No corrections provided")
            return True
            
        try:
            corrections = json.loads(corrections_json)
        except json.JSONDecodeError as e:
            log_status("error", f"Invalid corrections JSON format: {str(e)}")
            return False
        
        log_status("info", f"Applying {len(corrections)} text corrections...")
        
        # Apply corrections
        total_replacements = 0
        for i, seg in enumerate(segments):
            if 'text' not in seg:
                continue
                
            original_text = seg['text']
            modified_text = original_text
            segment_replacements = 0
            
            for wrong, correct in corrections.items():
                if wrong in modified_text:
                    count_before = modified_text.count(wrong)
                    modified_text = modified_text.replace(wrong, correct)
                    count_after = modified_text.count(wrong)
                    replacements_made = count_before - count_after
                    
                    if replacements_made > 0:
                        segment_replacements += replacements_made
                        total_replacements += replacements_made
                        log_status("info", f"Segment {i+1}: '{wrong}' → '{correct}' ({replacements_made} times)")
            
            # Update the segment text
            seg['text'] = modified_text
        
        # Save the corrected transcription
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(segments, f, ensure_ascii=False, indent=2)
        
        log_status("success", f"Applied {total_replacements} corrections and saved to {os.path.basename(output_path)}")
        return True
        
    except Exception as e:
        log_status("error", f"Error applying corrections: {str(e)}")
        return False

def main():
    if len(sys.argv) < 3:
        log_status("error", "Usage: python apply-corrections.py <json_file> <corrections_json> [output_file]")
        sys.exit(1)
    
    json_file_path = sys.argv[1]
    corrections_json = sys.argv[2]
    output_path = sys.argv[3] if len(sys.argv) > 3 else None
    
    log_status("info", f"Processing file: {os.path.basename(json_file_path)}")
    
    success = apply_corrections_to_json(json_file_path, corrections_json, output_path)
    
    if not success:
        sys.exit(1)

if __name__ == "__main__":
    main()