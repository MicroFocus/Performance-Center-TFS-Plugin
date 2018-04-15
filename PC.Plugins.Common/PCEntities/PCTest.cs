using System;
using System.IO;
using System.Xml;
using System.Xml.Serialization;
using PC.Plugins.Common.Helper;
using PC.Plugins.Common.Constants;

namespace PC.Plugins.Common.PCEntities
{
    [XmlRoot(Namespace = PCConstants.PC_API_XMLNS, ElementName = "Test", DataType = "string", IsNullable = true)]
    public class PCTest
	{
        //[XmlIgnore]
        //private int _reportId;

        [XmlElement("ID")]
        public virtual int ID
        {
            get; set;
        }

        [XmlElement("Name")]
        public virtual string Name
        {
            get; set;
		}

        [XmlElement("TestFolderPath")]
        public virtual string TestFolderPath
        {
            get; set;
        }

        [XmlElement("Content")]
        public virtual Content PCTestContent
        {
            get; set;
        }

        [XmlElement("ReportId")]
        public int ReportId => (this.PCTestContent.ContentAutomaticTrending != null) ? this.PCTestContent.ContentAutomaticTrending.ReportId : 0;

        public static PCTest XMLToObject(string xml)
        {
            XmlRootAttribute xRoot = new XmlRootAttribute
            {
                ElementName = "Test",
                IsNullable = true,
                Namespace = PCConstants.PC_API_XMLNS,
            };

            XmlSerializer serializer = new XmlSerializer(typeof(PCTest), xRoot);
            PCTest pcTest;
            using (StringReader reader = new StringReader(xml))
            {
                pcTest = (PCTest)serializer.Deserialize(reader);
            }
            return pcTest;
        }

        //could be problematic for empty values
        public static PCTest XMLToObject2(string xml)
        {
            Serializer serialzer = new Serializer();
            serialzer.SerXmlRootAttribute = new XmlRootAttribute
            {
                ElementName = "Test",
                IsNullable = true,
                Namespace = PCConstants.PC_API_XMLNS,
            };
            return serialzer.Deserialize<PCTest>(xml);
        }

    }

    [XmlRoot("Content")]
    public class Content
    {

        [XmlElement("AutomaticTrending")]
        public AutomaticTrending ContentAutomaticTrending
        {
            get; set;
        }
    }

    [XmlRoot("AutomaticTrending")]
    public class AutomaticTrending
    {

        [XmlElement("ReportId")]
        public int ReportId
        {
            get; set;
        }
    }

}