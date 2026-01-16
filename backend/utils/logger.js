import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Advanced Logger System for Faktions-Live API Backend
 * Saves all console outputs to timestamped files in logs folder
 */
class Logger {
  constructor() {
    this.logsDir = path.join(__dirname, '..', 'logs');
    this.ensureLogsDirectory();
    
    // Create daily log file
    const today = new Date().toISOString().split('T')[0];
    this.currentLogFile = path.join(this.logsDir, `backend-${today}.log`);
    
    // Store original console methods
    this.originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info,
      debug: console.debug
    };
    
    // Override console methods
    this.overrideConsole();
    
    console.log(`[Logger] Logging system initialized. Logs will be saved to: ${this.logsDir}`);
  }

  /**
   * Ensure logs directory exists
   */
  ensureLogsDirectory() {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
      console.log(`[Logger] Created logs directory: ${this.logsDir}`);
    }
  }

  /**
   * Get current timestamp for log entries
   */
  getTimestamp() {
    return new Date().toISOString();
  }

  /**
   * Write log entry to file
   */
  writeToFile(level, message, data = null) {
    try {
      const timestamp = this.getTimestamp();
      let logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
      
      if (data) {
        if (typeof data === 'object') {
          logEntry += `\n${JSON.stringify(data, null, 2)}`;
        } else {
          logEntry += `\n${data}`;
        }
      }
      
      logEntry += '\n' + '-'.repeat(80) + '\n';
      
      fs.appendFileSync(this.currentLogFile, logEntry);
    } catch (error) {
      // Fallback to original console if file writing fails
      this.originalConsole.error(`[Logger] Failed to write to log file:`, error);
    }
  }

  /**
   * Override console methods to capture all output
   */
  overrideConsole() {
    // Override console.log
    console.log = (...args) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      
      this.writeToFile('INFO', message);
      this.originalConsole.log(...args);
    };

    // Override console.error
    console.error = (...args) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      
      this.writeToFile('ERROR', message);
      this.originalConsole.error(...args);
    };

    // Override console.warn
    console.warn = (...args) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      
      this.writeToFile('WARN', message);
      this.originalConsole.warn(...args);
    };

    // Override console.info
    console.info = (...args) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      
      this.writeToFile('INFO', message);
      this.originalConsole.info(...args);
    };

    // Override console.debug
    console.debug = (...args) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      
      this.writeToFile('DEBUG', message);
      this.originalConsole.debug(...args);
    };
  }

  /**
   * Log specific system events with additional context
   */
  logSystemEvent(event, data = null) {
    const message = `[SYSTEM EVENT] ${event}`;
    this.writeToFile('SYSTEM', message, data);
    this.originalConsole.log(message, data);
  }

  /**
   * Log API requests with full details
   */
  logApiRequest(method, endpoint, body = null, headers = null) {
    const data = {
      method,
      endpoint,
      body: body ? JSON.stringify(body, null, 2) : null,
      headers: headers ? JSON.stringify(headers, null, 2) : null,
      timestamp: this.getTimestamp()
    };
    
    this.writeToFile('API_REQUEST', `${method} ${endpoint}`, data);
    this.originalConsole.log(`[API Request] ${method} ${endpoint}`, data);
  }

  /**
   * Log API responses with full details
   */
  logApiResponse(method, endpoint, statusCode, response = null) {
    const data = {
      method,
      endpoint,
      statusCode,
      response: response ? JSON.stringify(response, null, 2) : null,
      timestamp: this.getTimestamp()
    };
    
    this.writeToFile('API_RESPONSE', `${method} ${endpoint} - ${statusCode}`, data);
    this.originalConsole.log(`[API Response] ${method} ${endpoint} - ${statusCode}`, data);
  }

  /**
   * Log agent operations with full context
   */
  logAgentOperation(operation, agentId, data = null) {
    const message = `[AGENT] ${operation} - Agent ID: ${agentId}`;
    this.writeToFile('AGENT', message, data);
    this.originalConsole.log(message, data);
  }

  /**
   * Log swarm operations with full context
   */
  logSwarmOperation(operation, swarmId, data = null) {
    const message = `[SWARM] ${operation} - Swarm ID: ${swarmId}`;
    this.writeToFile('SWARM', message, data);
    this.originalConsole.log(message, data);
  }

  /**
   * Log meeting processing with full context
   */
  logMeetingProcessing(meetingId, step, data = null) {
    const message = `[MEETING] ${step} - Meeting ID: ${meetingId}`;
    this.writeToFile('MEETING', message, data);
    this.originalConsole.log(message, data);
  }

  /**
   * Get list of available log files
   */
  getLogFiles() {
    try {
      const files = fs.readdirSync(this.logsDir);
      return files.filter(file => file.endsWith('.log')).sort().reverse();
    } catch (error) {
      this.originalConsole.error(`[Logger] Failed to get log files:`, error);
      return [];
    }
  }

  /**
   * Read specific log file content
   */
  readLogFile(filename) {
    try {
      const filePath = path.join(this.logsDir, filename);
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf8');
      }
      return null;
    } catch (error) {
      this.originalConsole.error(`[Logger] Failed to read log file ${filename}:`, error);
      return null;
    }
  }

  /**
   * Clean old log files (keep last 30 days)
   */
  cleanOldLogs() {
    try {
      const files = this.getLogFiles();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      files.forEach(filename => {
        const filePath = path.join(this.logsDir, filename);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime < thirtyDaysAgo) {
          fs.unlinkSync(filePath);
          this.originalConsole.log(`[Logger] Cleaned old log file: ${filename}`);
        }
      });
    } catch (error) {
      this.originalConsole.error(`[Logger] Failed to clean old logs:`, error);
    }
  }

  /**
   * Get current log file path
   */
  getCurrentLogFile() {
    return this.currentLogFile;
  }

  /**
   * Get logs directory path
   */
  getLogsDirectory() {
    return this.logsDir;
  }
}

// Create and export logger instance
const logger = new Logger();

export default logger;
