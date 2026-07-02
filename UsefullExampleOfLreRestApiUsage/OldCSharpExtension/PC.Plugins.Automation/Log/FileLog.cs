using System;
using System.IO;
using System.Text;

namespace PC.Plugins.Automation
{
    /// <summary>
    /// Log file implementation
    /// </summary>
    public class FileLog : AbstractLog
    {
        #region Fields

        /// <summary>
        /// The name of the log file to which the data will be written
        /// </summary>
        private string _fileName = "";        

        #endregion

        #region Properties
        
        /// <summary>
        /// The name of the log file to which the data will be written
        /// </summary>
        public string FileName
        {
            get { return _fileName; }
            set { _fileName = value; }
        }

        #endregion

        #region Methods

        #region Constructors

        /// <summary>
        /// Default constructor.
        /// </summary>
        /// <param name="fileName">
        /// The name of the log file.
        /// </param>
        public FileLog(string fileName)
        {
            #region make sure fileName is not null/empty
            if (string.IsNullOrEmpty(fileName) == true)
            {
                throw new Exception("failed to construct: null/empty fileName");
            }
            #endregion
            try
            {
                FileInfo logFile = new FileInfo(fileName);
                if (!logFile.Exists)
                {
                    if (!logFile.Directory.Exists)
                        logFile.Directory.Create();
                    using (var stream = File.Create(fileName)) { };
                }
            }
            catch 
            {

            }
            
            try
            {
                // make sure we can access the log file
                using (StreamWriter writer = new StreamWriter(fileName, true)) { }
            }


            catch //(Exception ex)
            {
                //throw new Exception("failed to construct (fileName=" + fileName + ")", ex);
            }
            


            FileName = fileName;
        }

        // prevent creating a file log without specifying the file name.
        public FileLog() { }

        #endregion

        /// <summary>
        /// Write a message to the log.
        /// </summary>
        /// <param name="messageType">
        /// The type of the message.
        /// </param>
        /// <param name="message">
        /// The message.
        /// </param>
        protected override void TemplateWrite(LogMessageType messageType, string message)
        {
            try
            {
                StringBuilder logEntry = new StringBuilder();
                logEntry.Append(DateTime.Now.ToString());
                logEntry.Append(" ");
                logEntry.Append(messageType.ToString());
                logEntry.Append(": ");
                logEntry.Append(message);

                lock (this)
                {
                    using (StreamWriter writer = new StreamWriter(FileName, true))
                    {
                        writer.WriteLine(logEntry.ToString());
                        writer.Flush();
                    }
                }
            }
            catch (Exception ex)
            {
                throw new Exception("failed to write message to log file (FileName=" + FileName + ", messageType=" + messageType.ToString() + ", message=" + message + ")", ex);
            }
        }

        /// <summary>
        /// Clear the log.
        /// </summary>
        protected override void TemplateClear()
        {
            try
            {
                lock (this)
                {
                    using (StreamWriter writer = new StreamWriter(FileName, false)) { }
                }
            }
            catch (Exception ex)
            {
                throw new Exception("failed to clear log file (FileName=" + FileName + ")", ex);
            }
        }

        #endregion
    }
}
