// python-events.js
const { ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

ipcMain.handle('run-audio-extraction', async (event, { inputPath, outputPath }) => {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'python', '1_extract_audio.py');
    
    console.log('🐍 Running Python script:', scriptPath);
    console.log('📁 Input:', inputPath);
    console.log('📁 Output:', outputPath);

    const pythonProcess = spawn('python', [scriptPath, inputPath, outputPath]);

    let hasError = false;
    let errorMessage = '';

    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString().trim();
      console.log(`Python stdout: ${output}`);

      // Parse progress updates
      if (output.startsWith('PROGRESS:')) {
        try {
          const progressData = JSON.parse(output.substring(9));
          // Send progress update to renderer
          event.sender.send('audio-extraction-progress', progressData);
        } catch (e) {
          console.error('Error parsing progress:', e);
        }
      }

      // Parse status updates
      if (output.startsWith('STATUS:')) {
        try {
          const statusData = JSON.parse(output.substring(7));
          // Send status update to renderer
          event.sender.send('audio-extraction-status', statusData);
        } catch (e) {
          console.error('Error parsing status:', e);
        }
      }
    });

    pythonProcess.stderr.on('data', (data) => {
      const error = data.toString().trim();
      console.error(`Python stderr: ${error}`);
      hasError = true;
      errorMessage += error + '\n';
    });

    pythonProcess.on('close', (code) => {
      console.log(`Python process exited with code: ${code}`);
      
      if (code === 0 && !hasError) {
        resolve({ success: true, message: 'Audio extraction completed successfully' });
      } else {
        reject({ 
          success: false, 
          error: errorMessage || `Process exited with code ${code}` 
        });
      }
    });

    pythonProcess.on('error', (error) => {
      console.error('Failed to start Python process:', error);
      reject({ 
        success: false, 
        error: `Failed to start Python process: ${error.message}` 
      });
    });
  });
});

// Additional handler for getting Python/ffmpeg status
ipcMain.handle('check-python-dependencies', async () => {
  return new Promise((resolve) => {
    // Check if Python is available
    const pythonCheck = spawn('python', ['--version']);
    
    pythonCheck.on('close', (code) => {
      if (code === 0) {
        // Check if ffmpeg is available
        const ffmpegCheck = spawn('ffmpeg', ['-version']);
        
        ffmpegCheck.on('close', (ffmpegCode) => {
          resolve({
            python: code === 0,
            ffmpeg: ffmpegCode === 0,
            ready: code === 0 && ffmpegCode === 0
          });
        });

        ffmpegCheck.on('error', () => {
          resolve({
            python: true,
            ffmpeg: false,
            ready: false
          });
        });
      } else {
        resolve({
          python: false,
          ffmpeg: false,
          ready: false
        });
      }
    });

    pythonCheck.on('error', () => {
      resolve({
        python: false,
        ffmpeg: false,
        ready: false
      });
    });
  });
});