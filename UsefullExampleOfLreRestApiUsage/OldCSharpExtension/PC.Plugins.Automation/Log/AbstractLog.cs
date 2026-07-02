using System;

namespace PC.Plugins.Automation
{
    /// <summary>
    /// Common Abstract log class defining the common members to all Log types.
    /// </summary>
    public abstract class AbstractLog
    {
        #region Fields

        private bool _enabled = true;
        
        #endregion

        #region Properties

        /// <summary>
        /// Gets/sets a value that indicates wherher a log is enabled for writing.
        /// </summary>
        public bool Enabled
        {
            get { return _enabled; }
            set { _enabled = value; }
        }

        #endregion

        #region Methods

        #region Public

        /// <summary>
        /// Write a message to the log.
        /// </summary>
        /// <param name="messageType">
        /// The type of the message.
        /// </param>
        /// <param name="message">
        /// The message.
        /// </param>
        /// <remarks>
        /// The TemplateWrite method which is implement in the derived class
        /// is called (Template Method design pattern).
        /// </remarks>
        public void Write(LogMessageType messageType, string message)
        {
            try
            {
                if (Enabled == true)
                {
                    LogMessageType safeMessageType = LogMessageType.Error;
                    //if (messageType != null)
                    {
                        safeMessageType = messageType;
                    }

                    string safeMessage = string.Empty;
                    if (message != null)
                    {
                        safeMessage = message;
                    }

                    TemplateWrite(safeMessageType, safeMessage);
                }
            }
            catch //(Exception ex)
            {
                string safeMessage = string.Empty;
                if (message != null)
                {
                    safeMessage = message;
                }

                string safeMessageTypeString = string.Empty;
                //if (messageType != null)
                {
                    safeMessageTypeString = messageType.ToString();
                }

                //throw new Exception("failed to write to log (Enabled=" + Enabled + ", messageType=" + safeMessageTypeString + ", message=" + safeMessage + ")", ex);
            }
        }

        /// <summary>
        /// Clear the log.
        /// </summary>
        /// <remarks>
        /// The TemplateClear method which is implement in the derived class
        /// is called (Template Method design pattern).
        /// </remarks>
        public void Clear()
        {
            try
            {
                TemplateClear();
            }
            catch (Exception ex)
            {
                throw new Exception("failed to clear log", ex);
            }
        }

        #endregion

        #region Abstract Template Methods

        /// <summary>
        /// Derived classes should implement a this method (Template Method design pattern).
        /// </summary>
        /// <param name="messageType">
        /// The type of the message.
        /// </param>
        /// <param name="message">
        /// The message.
        /// </param>
        protected abstract void TemplateWrite(LogMessageType messageType, string message);

        /// <summary>
        /// Derived classes should implement a this method (Template Method design pattern).
        /// </summary>
        protected abstract void TemplateClear();

        #endregion

        #endregion
    }
}
