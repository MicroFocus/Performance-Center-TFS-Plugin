using System;
using System.Text;

namespace PC.Plugins.Automation
{
    /// <summary>
    /// Console log implementation
    /// </summary>
    public class ConsoleLog : AbstractLog
    {
        #region Methods

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
            StringBuilder logEntry = new StringBuilder();
            logEntry.Append(DateTime.Now.ToString());
            logEntry.Append(" ");
            logEntry.Append(messageType.ToString());
            logEntry.Append(": ");
            logEntry.Append(message);

            lock (this)
            {
                Console.WriteLine(logEntry.ToString());
            }
        }

        /// <summary>
        /// Clear the log.
        /// </summary>
        protected override void TemplateClear()
        {
            lock (this)
            {
                Console.Clear();
            }
        }

        #endregion
    }
}
