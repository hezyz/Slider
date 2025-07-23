const { ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// You need to get a reference to your main window - adjust this based on your main.js setup
let mainWindow;

// Add this function to set the main window reference
function setMainWindow(window) {
  mainWindow = window;
}

// Helper function to get the local Python command
function getPythonCommand() {
  const platform = process.platform;
  
  if (platform === 'darwin') { // macOS
    // Use local virtual environment Python first
    const localPython = path.join(__dirname, '..', 'python-env', 'bin', 'python');
    
    console.log('Checking for local Python at:', localPython);
    console.log('Local Python exists:', fs.existsSync(localPython));
    
    // Check if local Python exists and has whisper
    if (fs.existsSync(localPython)) {
      console.log('Using local Python environment:', localPython);
      return localPython;
    }
    
    console.log('Local Python not found, falling back to system python3');
    // Fallback to system python3
    return 'python3';
  } else if (platform === 'win32') {
    // Windows virtual environment
    const localPython = path.join(__dirname, '..', 'python-env', 'Scripts', 'python.exe');
    
    if (fs.existsSync(localPython)) {
      return localPython;
    }
    
    return 'python';
  } else {
    // Linux
    const localPython = path.join(__dirname, '..', 'python-env', 'bin', 'python');
    
    if (fs.existsSync(localPython)) {
      return localPython;
    }
    
    return 'python';
  }
}

// Select video file
ipcMain.handle('select-video-file', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Select Video File',
    properties: ['openFile'],
    filters: [
      { 
        name: 'Video Files', 
        extensions: ['mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'webm', 'm4v', '3gp'] 
      },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  
  return result.filePaths[0];
});

// Copy video to project files folder
ipcMain.handle('copy-video-to-project', async (_event, { sourcePath, projectName }) => {
  try {
    const projectsBasePath = path.join(__dirname, '..', 'projects');
    const projectPath = path.join(projectsBasePath, projectName);
    const filesFolder = path.join(projectPath, 'files');
    
    // Ensure project exists
    if (!fs.existsSync(projectPath)) {
      return { success: false, error: 'Project does not exist' };
    }
    
    // Create files folder if it doesn't exist
    if (!fs.existsSync(filesFolder)) {
      fs.mkdirSync(filesFolder, { recursive: true });
    }
    
    // Get file extension and create destination path
    const fileExtension = path.extname(sourcePath);
    const fileName = `video${fileExtension}`;
    const destinationPath = path.join(filesFolder, fileName);
    
    // Check if source file exists
    if (!fs.existsSync(sourcePath)) {
      return { success: false, error: 'Source video file does not exist' };
    }
    
    // Copy the file
    fs.copyFileSync(sourcePath, destinationPath);
    
    // Return relative path from app root for use in audio extraction
    const relativePath = path.join('projects', projectName, 'files', fileName);
    
    return { 
      success: true, 
      destinationPath: relativePath,
      absolutePath: destinationPath,
      fileName: fileName
    };
    
  } catch (error) {
    console.error('Error copying video to project:', error);
    return { success: false, error: error.message };
  }
});

// Check Python dependencies with detailed debugging
ipcMain.handle('check-python-dependencies', async () => {
  try {
    const pythonCommand = getPythonCommand();
    console.log('Checking Python dependencies with command:', pythonCommand);
    
    // Check Python and Whisper together with detailed output
    const pythonCheck = spawn(pythonCommand, ['-c', 'import whisper; print("OK")']);
    const pythonPromise = new Promise((resolve) => {
      let output = '';
      let error = '';
      
      pythonCheck.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      pythonCheck.stderr.on('data', (data) => {
        error += data.toString();
      });
      
      pythonCheck.on('close', (code) => {
        console.log('Python check results:');
        console.log('- Exit code:', code);
        console.log('- Stdout:', output.trim());
        console.log('- Stderr:', error.trim());
        console.log('- Success:', code === 0 && output.includes('OK'));
        
        resolve(code === 0 && output.includes('OK'));
      });
      
      pythonCheck.on('error', (err) => {
        console.log('Python check error:', err.message);
        resolve(false);
      });
    });

    // Check ffmpeg
    const ffmpegCheck = spawn('ffmpeg', ['-version']);
    const ffmpegPromise = new Promise((resolve) => {
      ffmpegCheck.on('close', (code) => {
        console.log('ffmpeg check - Exit code:', code);
        resolve(code === 0);
      });
      ffmpegCheck.on('error', (err) => {
        console.log('ffmpeg check error:', err.message);
        resolve(false);
      });
    });

    const [python, ffmpeg] = await Promise.all([pythonPromise, ffmpegPromise]);
    
    console.log('Final dependency check results:');
    console.log('Python + Whisper:', python);
    console.log('ffmpeg:', ffmpeg);
    
    return {
      python,
      ffmpeg,
      ready: python && ffmpeg
    };
  } catch (error) {
    console.error('Error checking dependencies:', error);
    return {
      python: false,
      ffmpeg: false,
      ready: false
    };
  }
});

// Audio extraction handler
ipcMain.handle('run-audio-extraction', async (_event, { inputPath, outputPath }) => {
  try {
    // Initialize paths
    let absoluteInputPath = inputPath;
    let absoluteOutputPath = outputPath;
    
    // Handle relative project paths
    if (inputPath.startsWith('projects/')) {
      absoluteInputPath = path.join(__dirname, '..', inputPath);
    }
    
    if (outputPath.startsWith('projects/')) {
      absoluteOutputPath = path.join(__dirname, '..', outputPath);
      
      // Ensure output directory exists
      const outputDir = path.dirname(absoluteOutputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
    }
    
    // Verify input file exists
    if (!fs.existsSync(absoluteInputPath)) {
      return { success: false, error: `Input file does not exist: ${absoluteInputPath}` };
    }
    
    // Get the correct Python command and script path
    const pythonCommand = getPythonCommand();
    const pythonScript = path.join(__dirname, 'python', '1_extract_audio.py');
    
    console.log('Audio extraction details:');
    console.log('Python command:', pythonCommand);
    console.log('Script path:', pythonScript);
    console.log('Input path:', absoluteInputPath);
    console.log('Output path:', absoluteOutputPath);
    
    return new Promise((resolve) => {
      const pythonProcess = spawn(pythonCommand, [pythonScript, absoluteInputPath, absoluteOutputPath]);
      
      let hasError = false;
      let errorMessage = '';
      
      pythonProcess.stdout.on('data', (data) => {
        const output = data.toString().trim();
        console.log('Python output:', output);
        
        // Parse structured output from Python script
        if (output.startsWith('PROGRESS:')) {
          try {
            const progressData = JSON.parse(output.substring(9));
            if (mainWindow && mainWindow.webContents) {
              mainWindow.webContents.send('audio-extraction-progress', progressData);
            }
          } catch (e) {
            console.error('Error parsing progress data:', e);
          }
        } else if (output.startsWith('STATUS:')) {
          try {
            const statusData = JSON.parse(output.substring(7));
            if (mainWindow && mainWindow.webContents) {
              mainWindow.webContents.send('audio-extraction-status', statusData);
            }
            
            if (statusData.status === 'error') {
              hasError = true;
              errorMessage = statusData.message;
            }
          } catch (e) {
            console.error('Error parsing status data:', e);
          }
        } else {
          // Handle regular log messages
          console.log('Python output:', output);
        }
      });
      
      pythonProcess.stderr.on('data', (data) => {
        const error = data.toString().trim();
        console.error('Python error:', error);
        hasError = true;
        errorMessage = error;
        
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('audio-extraction-status', {
            type: 'status',
            status: 'error',
            message: `Python error: ${error}`
          });
        }
      });
      
      pythonProcess.on('close', (code) => {
        console.log('Python process closed with code:', code);
        if (code === 0 && !hasError) {
          resolve({ success: true });
        } else {
          resolve({ 
            success: false, 
            error: errorMessage || `Python process exited with code ${code}` 
          });
        }
      });
      
      pythonProcess.on('error', (error) => {
        console.error('Failed to start Python process:', error);
        resolve({ 
          success: false, 
          error: `Failed to start Python process: ${error.message}` 
        });
      });
    });
    
  } catch (error) {
    console.error('Error in audio extraction:', error);
    return { success: false, error: error.message };
  }
});

// Transcription handler with improved process management
ipcMain.handle('run-transcription', async (_event, { audioPath, outputPath, corrections, language = 'he', modelSize = 'medium' }) => {
  try {
    // Initialize paths
    let absoluteAudioPath = audioPath;
    let absoluteOutputPath = outputPath;
    
    // Handle relative project paths
    if (audioPath.startsWith('projects/')) {
      absoluteAudioPath = path.join(__dirname, '..', audioPath);
    }
    
    if (outputPath.startsWith('projects/')) {
      absoluteOutputPath = path.join(__dirname, '..', outputPath);
      
      // Ensure output directory exists
      const outputDir = path.dirname(absoluteOutputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
    }
    
    // Verify audio file exists
    if (!fs.existsSync(absoluteAudioPath)) {
      return { success: false, error: `Audio file does not exist: ${absoluteAudioPath}` };
    }
    
    // Check file size and recommend smaller model for large files
    const stats = fs.statSync(absoluteAudioPath);
    const fileSizeMB = stats.size / (1024 * 1024);
    
    console.log(`Audio file size: ${fileSizeMB.toFixed(2)} MB`);
    
    if (fileSizeMB > 50 && modelSize !== 'tiny') {
      console.log('Large file detected, consider using tiny model');
    }
    
    // Get the correct Python command and script path
    const pythonCommand = getPythonCommand();
    const pythonScript = path.join(__dirname, 'python', '2_transcribe_audio.py');
    
    console.log('Transcription details:');
    console.log('Python command:', pythonCommand);
    console.log('Script path:', pythonScript);
    console.log('Audio path:', absoluteAudioPath);
    console.log('Output path:', absoluteOutputPath);
    console.log('Language:', language);
    console.log('Model size:', modelSize);
    console.log('File size:', `${fileSizeMB.toFixed(2)} MB`);
    
    return new Promise((resolve) => {
      const args = [
        pythonScript,
        absoluteAudioPath,
        absoluteOutputPath,
        corrections || 'null',
        language,
        modelSize
      ];
      
      console.log('Full command:', pythonCommand, args.join(' '));
      
      // Spawn process with increased memory and timeout
      const pythonProcess = spawn(pythonCommand, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          // Set Python memory limits
          PYTHONUNBUFFERED: '1',
          OMP_NUM_THREADS: '1', // Limit OpenMP threads to reduce memory usage
          MKL_NUM_THREADS: '1', // Limit MKL threads
          NUMEXPR_NUM_THREADS: '1', // Limit NumExpr threads
          OPENBLAS_NUM_THREADS: '1', // Limit OpenBLAS threads
          // Add memory limit for PyTorch
          PYTORCH_CUDA_ALLOC_CONF: 'max_split_size_mb:512'
        }
      });
      
      let hasError = false;
      let errorMessage = '';
      let lastActivity = Date.now();
      
      // Set up timeout (30 minutes for transcription)
      const timeout = setTimeout(() => {
        console.log('Transcription timeout reached, killing process...');
        pythonProcess.kill('SIGTERM');
        
        setTimeout(() => {
          if (!pythonProcess.killed) {
            console.log('Force killing process...');
            pythonProcess.kill('SIGKILL');
          }
        }, 5000);
        
        resolve({ 
          success: false, 
          error: 'Transcription timed out. Try using a smaller model (tiny or base) or a shorter audio file.' 
        });
      }, 30 * 60 * 1000); // 30 minutes
      
      pythonProcess.stdout.on('data', (data) => {
        lastActivity = Date.now();
        const output = data.toString().trim();
        
        // Split by lines in case multiple JSON objects are on same line
        const lines = output.split('\n');
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;
          
          console.log('Transcription output line:', trimmedLine);
          
          // Parse structured output from Python script
          if (trimmedLine.startsWith('PROGRESS:')) {
            try {
              const progressData = JSON.parse(trimmedLine.substring(9));
              if (mainWindow && mainWindow.webContents) {
                mainWindow.webContents.send('transcription-progress', progressData);
              }
            } catch (e) {
              console.error('Error parsing transcription progress data:', e);
              console.error('Problematic line:', trimmedLine);
            }
          } else if (trimmedLine.startsWith('STATUS:')) {
            try {
              const statusData = JSON.parse(trimmedLine.substring(7));
              if (mainWindow && mainWindow.webContents) {
                mainWindow.webContents.send('transcription-status', statusData);
              }
              
              if (statusData.status === 'error') {
                hasError = true;
                errorMessage = statusData.message;
              }
            } catch (e) {
              console.error('Error parsing transcription status data:', e);
              console.error('Problematic line:', trimmedLine);
            }
          } else {
            // Handle regular log messages
            console.log('Transcription output:', trimmedLine);
          }
        }
      });
      
      pythonProcess.stderr.on('data', (data) => {
        lastActivity = Date.now();
        const error = data.toString().trim();
        
        // Filter out common Whisper warnings that aren't real errors
        const ignoredWarnings = [
          'FP16 is not supported on CPU',
          'UserWarning',
          'omp_set_nested routine deprecated',
          'resource_tracker',
          'frames/s',
          '%|',
          'warnings.warn'
        ];
        
        const isIgnoredWarning = ignoredWarnings.some(warning => error.includes(warning));
        
        // Check for memory errors
        const isMemoryError = error.includes('MemoryError') || 
                             error.includes('out of memory') || 
                             error.includes('killed') ||
                             error.includes('Killed');
        
        if (isMemoryError) {
          console.error('Memory error detected:', error);
          hasError = true;
          errorMessage = 'Out of memory. Try using a smaller model (tiny or base) or a shorter audio file.';
          
          if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('transcription-status', {
              type: 'status',
              status: 'error',
              message: errorMessage
            });
          }
        } else if (!isIgnoredWarning) {
          console.error('Transcription error:', error);
          hasError = true;
          errorMessage = error;
          
          if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('transcription-status', {
              type: 'status',
              status: 'error',
              message: `Python transcription error: ${error}`
            });
          }
        } else {
          // Just log warnings without treating as errors
          console.log('Transcription warning (ignored):', error);
        }
      });
      
      pythonProcess.on('close', (code) => {
        clearTimeout(timeout);
        console.log('Transcription process closed with code:', code);
        
        if (code === null) {
          // Process was killed/terminated
          resolve({ 
            success: false, 
            error: 'Transcription was interrupted. This usually happens due to memory constraints. Try using a smaller model (tiny or base).' 
          });
        } else if (code === 0 && !hasError) {
          resolve({ success: true });
        } else {
          resolve({ 
            success: false, 
            error: errorMessage || `Python transcription process exited with code ${code}` 
          });
        }
      });
      
      pythonProcess.on('error', (error) => {
        clearTimeout(timeout);
        console.error('Failed to start transcription process:', error);
        resolve({ 
          success: false, 
          error: `Failed to start transcription process: ${error.message}` 
        });
      });
      
      // Handle process being killed
      pythonProcess.on('exit', (code, signal) => {
        clearTimeout(timeout);
        if (signal === 'SIGKILL' || signal === 'SIGTERM') {
          console.log('Process was killed with signal:', signal);
          resolve({ 
            success: false, 
            error: 'Transcription process was terminated. Try using a smaller model or shorter audio file.' 
          });
        }
      });
    });
    
  } catch (error) {
    console.error('Error in transcription:', error);
    return { success: false, error: error.message };
  }
});

// Setup local Python environment
ipcMain.handle('setup-local-python', async () => {
  try {
    const projectRoot = path.join(__dirname, '..');
    const envPath = path.join(projectRoot, 'python-env');
    
    console.log('Setting up local Python environment...');
    console.log('Project root:', projectRoot);
    console.log('Environment path:', envPath);
    
    // Check if environment already exists
    if (fs.existsSync(envPath)) {
      // Test if it has whisper
      const pythonPath = path.join(envPath, 'bin', 'python');
      if (fs.existsSync(pythonPath)) {
        const testResult = await new Promise((resolve) => {
          const testProcess = spawn(pythonPath, ['-c', 'import whisper; print("OK")']);
          testProcess.on('close', (code) => resolve(code === 0));
          testProcess.on('error', () => resolve(false));
        });
        
        if (testResult) {
          return { success: true, message: 'Local Python environment already exists and works!' };
        }
      }
      
      // Remove broken environment
      console.log('Removing broken environment...');
      fs.rmSync(envPath, { recursive: true, force: true });
    }
    
    return new Promise((resolve) => {
      console.log('Creating virtual environment...');
      const createEnv = spawn('python3', ['-m', 'venv', envPath]);
      
      createEnv.stdout.on('data', (data) => {
        console.log('venv stdout:', data.toString());
      });
      
      createEnv.stderr.on('data', (data) => {
        console.log('venv stderr:', data.toString());
      });
      
      createEnv.on('close', (code) => {
        if (code !== 0) {
          resolve({ success: false, error: `Failed to create virtual environment (exit code: ${code})` });
          return;
        }
        
        console.log('Virtual environment created, installing Whisper...');
        
        // Install whisper in the new environment
        const pythonPath = path.join(envPath, 'bin', 'python');
        const installWhisper = spawn(pythonPath, ['-m', 'pip', 'install', 'openai-whisper', 'pydub']);
        
        installWhisper.stdout.on('data', (data) => {
          console.log('pip stdout:', data.toString());
        });
        
        installWhisper.stderr.on('data', (data) => {
          console.log('pip stderr:', data.toString());
        });
        
        installWhisper.on('close', (installCode) => {
          if (installCode === 0) {
            console.log('Whisper installed successfully!');
            resolve({ 
              success: true, 
              message: 'Local Python environment setup complete with Whisper!',
              pythonPath 
            });
          } else {
            resolve({ 
              success: false, 
              error: `Failed to install Whisper (exit code: ${installCode})` 
            });
          }
        });
        
        installWhisper.on('error', (error) => {
          resolve({ 
            success: false, 
            error: `Failed to install Whisper: ${error.message}` 
          });
        });
      });
      
      createEnv.on('error', (error) => {
        resolve({ 
          success: false, 
          error: `Failed to create environment: ${error.message}` 
        });
      });
    });
    
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Test local Python environment
ipcMain.handle('test-local-python', async () => {
  try {
    const pythonCommand = getPythonCommand();
    const envPath = path.join(__dirname, '..', 'python-env');
    
    console.log('=== Local Python Environment Test ===');
    console.log('Project root:', path.join(__dirname, '..'));
    console.log('Environment path:', envPath);
    console.log('Environment exists:', fs.existsSync(envPath));
    console.log('Python command:', pythonCommand);
    console.log('Python executable exists:', fs.existsSync(pythonCommand));
    
    // Test Python import
    const result = await new Promise((resolve) => {
      const testProcess = spawn(pythonCommand, ['-c', 'import whisper; print("SUCCESS: Whisper found!"); print("Python path:", __file__)']);
      let output = '';
      let error = '';
      
      testProcess.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      testProcess.stderr.on('data', (data) => {
        error += data.toString();
      });
      
      testProcess.on('close', (code) => {
        resolve({
          exitCode: code,
          output: output.trim(),
          error: error.trim(),
          success: code === 0 && output.includes('SUCCESS')
        });
      });
      
      testProcess.on('error', (err) => {
        resolve({
          exitCode: -1,
          output: '',
          error: err.message,
          success: false
        });
      });
    });
    
    console.log('Test result:', result);
    
    return {
      pythonCommand,
      envPath,
      envExists: fs.existsSync(envPath),
      pythonExists: fs.existsSync(pythonCommand),
      testResult: result
    };
    
  } catch (error) {
    console.error('Test error:', error);
    return { error: error.message };
  }
});

// Debug Python environment
ipcMain.handle('debug-python-environment', async () => {
  try {
    const pythonCommand = getPythonCommand();
    
    console.log('Testing Python environment...');
    console.log('Current working directory:', process.cwd());
    console.log('Python command:', pythonCommand);
    console.log('Environment PATH:', process.env.PATH);
    
    // Test Python version
    const versionResult = await new Promise((resolve) => {
      const versionCheck = spawn(pythonCommand, ['--version']);
      let output = '';
      
      versionCheck.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      versionCheck.stderr.on('data', (data) => {
        output += data.toString();
      });
      
      versionCheck.on('close', (code) => {
        resolve({ success: code === 0, output: output.trim() });
      });
    });
    
    // Test Whisper import
    const whisperResult = await new Promise((resolve) => {
      const whisperCheck = spawn(pythonCommand, ['-c', 'import whisper; print("Whisper version:", whisper.__version__)']);
      let output = '';
      let error = '';
      
      whisperCheck.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      whisperCheck.stderr.on('data', (data) => {
        error += data.toString();
      });
      
      whisperCheck.on('close', (code) => {
        resolve({ 
          success: code === 0, 
          output: output.trim(), 
          error: error.trim() 
        });
      });
    });
    
    // Test Python path
    const pathResult = await new Promise((resolve) => {
      const pathCheck = spawn(pythonCommand, ['-c', 'import sys; print("Python executable:", sys.executable); print("Python path:", sys.path)']);
      let output = '';
      
      pathCheck.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      pathCheck.on('close', (code) => {
        resolve({ success: code === 0, output: output.trim() });
      });
    });
    
    return {
      cwd: process.cwd(),
      pythonCommand,
      envPath: process.env.PATH,
      version: versionResult,
      whisper: whisperResult,
      pythonPath: pathResult
    };
    
  } catch (error) {
    return { error: error.message };
  }
});

// NEW: Translation handler - ADD THIS TO YOUR EXISTING FILE
ipcMain.handle('run-translation', async (_event, params) => {
  try {
    const { 
      inputPath, 
      outputPath, 
      apiKey, 
      systemPrompt, 
      sourceLanguage = 'he', 
      targetLanguage = 'en', 
      model = 'gpt-4' 
    } = params;
    
    // Initialize paths
    let absoluteInputPath = inputPath;
    let absoluteOutputPath = outputPath;
    
    // Handle relative project paths
    if (inputPath.startsWith('projects/')) {
      absoluteInputPath = path.join(__dirname, '..', inputPath);
    }
    
    if (outputPath.startsWith('projects/')) {
      absoluteOutputPath = path.join(__dirname, '..', outputPath);
      
      // Ensure output directory exists
      const outputDir = path.dirname(absoluteOutputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
    }
    
    // Verify input file exists
    if (!fs.existsSync(absoluteInputPath)) {
      return { success: false, error: `Input file does not exist: ${absoluteInputPath}` };
    }
    
    // Validate required parameters
    if (!apiKey || !apiKey.trim()) {
      return { success: false, error: 'API key is required for translation' };
    }
    
    if (!systemPrompt || !systemPrompt.trim()) {
      return { success: false, error: 'System prompt is required for translation' };
    }
    
    // Get the correct Python command and script path
    const pythonCommand = getPythonCommand();
    const pythonScript = path.join(__dirname, 'python', '3_translate_text.py');
    
    console.log('Translation details:');
    console.log('Python command:', pythonCommand);
    console.log('Script path:', pythonScript);
    console.log('Input path:', absoluteInputPath);
    console.log('Output path:', absoluteOutputPath);
    console.log('Source language:', sourceLanguage);
    console.log('Target language:', targetLanguage);
    console.log('Model:', model);
    console.log('API key length:', apiKey.length);
    
    return new Promise((resolve) => {
      const args = [
        pythonScript,
        absoluteInputPath,
        absoluteOutputPath,
        apiKey,
        systemPrompt,
        sourceLanguage,
        targetLanguage,
        model
      ];
      
      console.log('Full translation command:', pythonCommand, args.slice(0, 3).join(' ') + ' [API_KEY] [PROMPT] ...');
      
      // Spawn process with timeout
      const pythonProcess = spawn(pythonCommand, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          PYTHONUNBUFFERED: '1'
        }
      });
      
      let hasError = false;
      let errorMessage = '';
      
      // Set up timeout (20 minutes for translation)
      const timeout = setTimeout(() => {
        console.log('Translation timeout reached, killing process...');
        pythonProcess.kill('SIGTERM');
        
        setTimeout(() => {
          if (!pythonProcess.killed) {
            console.log('Force killing translation process...');
            pythonProcess.kill('SIGKILL');
          }
        }, 5000);
        
        resolve({ 
          success: false, 
          error: 'Translation timed out. This may happen with very long texts or API rate limits.' 
        });
      }, 20 * 60 * 1000); // 20 minutes
      
      pythonProcess.stdout.on('data', (data) => {
        const output = data.toString().trim();
        
        // Split by lines in case multiple JSON objects are on same line
        const lines = output.split('\n');
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;
          
          console.log('Translation output:', trimmedLine);
          
          // Parse structured output from Python script
          if (trimmedLine.startsWith('STATUS:')) {
            try {
              const statusData = JSON.parse(trimmedLine.substring(7));
              if (mainWindow && mainWindow.webContents) {
                mainWindow.webContents.send('translation-status', statusData);
              }
              
              if (statusData.status === 'error') {
                hasError = true;
                errorMessage = statusData.message;
              }
            } catch (e) {
              console.error('Error parsing translation status data:', e);
              console.error('Problematic line:', trimmedLine);
            }
          } else {
            // Handle regular log messages
            console.log('Translation log:', trimmedLine);
          }
        }
      });
      
      pythonProcess.stderr.on('data', (data) => {
        const error = data.toString().trim();
        console.error('Translation error:', error);
        
        // Check for common API errors
        if (error.includes('401') || error.includes('Unauthorized')) {
          hasError = true;
          errorMessage = 'Invalid API key. Please check your OpenAI API key.';
        } else if (error.includes('429') || error.includes('rate_limit')) {
          hasError = true;
          errorMessage = 'API rate limit exceeded. Please wait and try again.';
        } else if (error.includes('insufficient_quota')) {
          hasError = true;
          errorMessage = 'Insufficient API quota. Please check your OpenAI account billing.';
        } else {
          hasError = true;
          errorMessage = error;
        }
        
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('translation-status', {
            type: 'status',
            status: 'error',
            message: errorMessage
          });
        }
      });
      
      pythonProcess.on('close', (code) => {
        clearTimeout(timeout);
        console.log('Translation process closed with code:', code);
        
        if (code === 0 && !hasError) {
          resolve({ success: true });
        } else {
          resolve({ 
            success: false, 
            error: errorMessage || `Translation process exited with code ${code}` 
          });
        }
      });
      
      pythonProcess.on('error', (error) => {
        clearTimeout(timeout);
        console.error('Failed to start translation process:', error);
        resolve({ 
          success: false, 
          error: `Failed to start translation process: ${error.message}` 
        });
      });
    });
    
  } catch (error) {
    console.error('Error in translation:', error);
    return { success: false, error: error.message };
  }
});

// Export the setMainWindow function so you can call it from your main.js
module.exports = { setMainWindow };