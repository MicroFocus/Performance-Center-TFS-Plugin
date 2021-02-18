using System;

namespace PC.Plugins.Common.Helper
{
    internal static class GeneralHelper
    {

        /// <summary>
        /// Create the folder if not existing for a full file name
        /// </summary>
        /// <param name="fullFileName">full path + name of the file</param>
        public static void CreateDirectoryForFileIfNotExisting(string fullFileName)
        {
            string folder = System.IO.Path.GetDirectoryName(fullFileName);
            if (!System.IO.Directory.Exists(folder))
            {
                System.IO.Directory.CreateDirectory(folder);
            }
        }

        public static string[] SpitPCServerAndTenant(string pcServerNameAndPort)
        {
            char delimiterSlash = '/';
            char delimiterQuestionMark = '?';
            char useDelimiter = delimiterSlash;
            String[] strServerAndTenant = { pcServerNameAndPort, "" };

            String theLreServer = pcServerNameAndPort;
            //replace for common mistakes
            if (!string.IsNullOrEmpty(pcServerNameAndPort))
            {
                theLreServer = pcServerNameAndPort.ToLower().Replace("http://", "");
                theLreServer = theLreServer.Replace("https://", "");
                theLreServer = theLreServer.Replace("/lre", "");
                theLreServer = theLreServer.Replace("/site", "");
                theLreServer = theLreServer.Replace("/loadtest", "");
                theLreServer = theLreServer.Replace("/pcx", "");
                theLreServer = theLreServer.Replace("/adminx", "");
                theLreServer = theLreServer.Replace("/admin", "");
                theLreServer = theLreServer.Replace("/login", "");
            }
            if (!string.IsNullOrEmpty(theLreServer))
            {
                if (theLreServer.Contains(delimiterSlash.ToString()))
                {
                    useDelimiter = delimiterSlash;
                }
                else if (theLreServer.Contains(delimiterQuestionMark.ToString()))
                {
                    useDelimiter = delimiterQuestionMark;
                }
                String[] severTenantArray = theLreServer.Split(useDelimiter);
                if (severTenantArray.Length > 0)
                {
                    strServerAndTenant[0] = severTenantArray[0];
                    if (severTenantArray.Length > 1)
                    {
                        if (useDelimiter.Equals(delimiterQuestionMark))
                        {
                            strServerAndTenant[1] = delimiterQuestionMark + severTenantArray[1];
                        }
                        else
                        {
                            strServerAndTenant[1] = severTenantArray[1];
                        }
                    }
                }
            }
            return strServerAndTenant;
        }

        internal static string[] Split(this string self, string regexDelimiter, bool trimTrailingEmptyStrings)
        {
            string[] splitArray = System.Text.RegularExpressions.Regex.Split(self, regexDelimiter);

            if (trimTrailingEmptyStrings)
            {
                if (splitArray.Length > 1)
                {
                    for (int i = splitArray.Length; i > 0; i--)
                    {
                        if (splitArray[i - 1].Length > 0)
                        {
                            if (i < splitArray.Length)
                                System.Array.Resize(ref splitArray, i);

                            break;
                        }
                    }
                }
            }
            return splitArray;
        }

        internal static sbyte[] GetBytes(this string self) => GetSBytesForEncoding(System.Text.Encoding.UTF8, self);

        private static sbyte[] GetSBytesForEncoding(System.Text.Encoding encoding, string s)
        {
            sbyte[] sbytes = new sbyte[encoding.GetByteCount(s)];
            encoding.GetBytes(s, 0, s.Length, (byte[])(object)sbytes, 0);
            return sbytes;
        }
    }
}