namespace PC.Plugins.Common.Helper
{
    internal static class GeneralHelper
    {

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
    }
}