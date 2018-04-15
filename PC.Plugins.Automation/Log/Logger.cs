using System;
using System.Collections.Generic;

namespace PC.Plugins.Automation
{
    /// <summary>
    /// Manage multiple log objects.
    /// </summary>
    /// <remarks>
    /// In case no log was created and the Write method is called, a ConsoleLog is created.
    /// </remarks>
    public class Logger
    {
        #region Fields

        /// <summary>
        /// Collection of key/value pairs where the key is the name of a log and the value
        /// is the log object associated with this name.
        /// </summary>
        private static IDictionary<string, AbstractLog> _logs = new SortedDictionary<string, AbstractLog>();

        #endregion

        #region Properties

        /// <summary>
        /// Collection of key/value pairs where the key is the name of a log and the value
        /// is the log object associated with this name.
        /// </summary>
        public static IDictionary<string, AbstractLog> Logs
        {
            get { return Logger._logs; }
            private set { Logger._logs = value; }
        }

        #endregion

        #region Methods

        /// <summary>
        /// Write a message to the available logs.
        /// </summary>
        /// <param name="messageType">
        /// The type of the message.
        /// </param>
        /// <param name="message">
        /// The message.
        /// </param>
        public static void Write(LogMessageType messageType, string message)
        {
            try
            {
                // if there are no logs, add console log
                lock (Logs)
                {
                    if (Logs.Count == 0)
                    {
                        Logs.Add(typeof(ConsoleLog).Name, new ConsoleLog());
                    }
                }

                foreach (AbstractLog log in Logs.Values)
                {
                    if (log != null)
                    {
                        try
                        {
                            log.Write(messageType, message);
                        }
                        catch (Exception) { } // what can we do !?
                    }
                }
            }
            catch (Exception) { } // what can we do !?
        }

        /// <summary>
        /// Clears all available logs.
        /// </summary>
        public static void Clear()
        {
            try
            {
                foreach (AbstractLog log in Logs.Values)
                {
                    if (log != null)
                    {
                        try
                        {
                            log.Clear();
                        }
                        catch (Exception) { } // what can we do !?
                    }
                }
            }
            catch (Exception) { } // what can we do !?
        }

        #endregion
    }
}
