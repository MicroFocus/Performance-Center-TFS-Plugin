using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Web;
using System.Text.RegularExpressions;
using System.Security.Cryptography;
using System.Xml.Serialization;
using System.Xml;


namespace PC.Plugins.Common.Client
{
    public class Utils
    {

        private static Client pcClient = new Client();
        public Client PCClient => pcClient;

        public static Dictionary<string, string> ParsePropertiesFile(string filePath)
        {
            var data = new Dictionary<string, string>();
            foreach (var row in File.ReadAllLines(filePath))
            {
                string key = row.Split('=')[0];
                string value = string.Join("=", row.Split('=').Skip(1).ToArray());
                data.Add(key, value);
            }
            return data;
        }

        public static string Salt()
        {
            string path = Path.GetRandomFileName();
            path = path.Replace(".", ""); // Remove period.
            return path;
        }

        //public static void ValidateMessage(string original, string searchMessage)
        //{
        //    Regex regex = new Regex(searchMessage);
        //    var match = regex.Match(original);
        //    if (!match.Success)
        //    {
        //        Assert.Fail("Error Expected message was : " + original);
        //    }
        //}

        public static bool ContainsMessage(string original, string searchMessage)
        {
            Regex regex = new Regex(searchMessage);
            var match = regex.Match(original);
            if (!match.Success)
            {
                return false;
            }
            return true;

        }



        //public static void ValidateMessageDoesntExist(string original, string searchMessage)
        //{
        //    Regex regex = new Regex(searchMessage);
        //    var match = regex.Match(original);
        //    if (match.Success)
        //    {
        //        Assert.Fail("Error Message was found : " + searchMessage);
        //    }
        //}

        public static string ConvertTime(DateTime interval) => interval.ToString("yyyy-MM-dd HH:mm:00");

        public static string ConvertTimeLic(DateTime interval) => interval.ToString("MM/dd/yyyy HH:mm:00");


        public static bool Validate(ClientResponse response, IList<int> expected)
        {
            if (!expected.Contains(response.StatusCode))
            {
                return false;
            }
            return true;
        }

        public static string CreateXML(Object classObject)
        {
            XmlDocument xmlDoc = new XmlDocument();          
            XmlSerializer xmlSerializer = new XmlSerializer(classObject.GetType());
            
            using (MemoryStream xmlStream = new MemoryStream())
            {
                xmlSerializer.Serialize(xmlStream, classObject);
                xmlStream.Position = 0;
               
                xmlDoc.Load(xmlStream);
                return xmlDoc.InnerXml;
            }
        }
    }
}
