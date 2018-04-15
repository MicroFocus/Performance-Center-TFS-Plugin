using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using Microsoft.Deployment.WindowsInstaller;
using System.IO;
using System.Diagnostics;
using System.Xml.Linq;
using System.Runtime.InteropServices;
using System.Globalization;
using System.Xml;

namespace PC.Plugins.Installer.CA
{
    public class CustomActions
    {
        [CustomAction]
        public static ActionResult open_log(Session session)
        {
            try
            {
                Process.Start(session["MsiLogFileLocation"]);
            }
            catch (Exception ex)
            {
                Debug.WriteLine(ex);
            }
            return ActionResult.Success;
        }
    }
}