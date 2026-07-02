using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

namespace PC.Plugins.Installer.CA
{
    public static class IniHelper
    {
        [DllImport("kernel32")]
        private static extern long WritePrivateProfileString(string section, string key, string val, string filePath);

        [DllImport("kernel32")]
        private static extern int GetPrivateProfileString(string section, string key, string def, StringBuilder retVal, int size, string filePath);



    }
}