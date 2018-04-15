using System.IO;
using System.Xml;
using System.Xml.Serialization;
using PC.Plugins.Common.Helper;
using PC.Plugins.Common.Constants;

namespace PC.Plugins.Common.PCEntities
{
    public class PCTestSet
    {

        [XmlElement("TestSetName")]
        public string TestSetName
        {
            get; set;
        }

        [XmlElement("TestSetComment")]
        public string TestSetComment
        {
            get; set;
        }

        [XmlElement("TestSetParentId")]
        public int TestSetParentId
        {
            get; set;
        }

        [XmlElement("TestSetID")]
        public int TestSetID
        {
            get; set;
        }

        public static PCTestSet XMLToObject(string xml)
        {
            XmlRootAttribute xRoot = new XmlRootAttribute
            {
                ElementName = "TestSet",
                IsNullable = true,
                //Namespace = PCConstants.PC_API_XMLNS,
            };
            
            XmlSerializer serializer = new XmlSerializer(typeof(PCTestSet), xRoot);
            PCTestSet pcTestSet;
            using (StringReader reader = new StringReader(xml))
            {
                pcTestSet = (PCTestSet)serializer.Deserialize(reader);
            }
            return pcTestSet;
        }

        public static PCTestSet XMLToObject2(string xml)
        {
            Serializer serialzer = new Serializer();
            serialzer.SerXmlRootAttribute = new XmlRootAttribute
            {
                ElementName = "TestSet",
                IsNullable = true,
                //Namespace = PCConstants.PC_API_XMLNS,
            };
            return serialzer.Deserialize<PCTestSet>(xml);
        }
    }

}