using System.IO;
using System.Xml;
using System.Xml.Serialization;
using PC.Plugins.Common.Helper;
using PC.Plugins.Common.Constants;

namespace PC.Plugins.Common.PCEntities
{

    public class PCRunEventLogRecord
    {

        [XmlElement("ID")]
        public virtual int ID
		{
            get; set;
		}

        [XmlElement("Type")]
        public virtual string Type
		{
            get;set;
		}

        [XmlElement("Time")]
        public virtual string Time
		{
            get; set;
		}

        [XmlElement("Name")]
        public virtual string Name
		{
            get; set;
		}

        [XmlElement("Description")]
        public virtual string Description
		{
            get; set;
		}

        [XmlElement("Responsible")]
        public virtual string Responsible
		{
            get; set;
		}

        public static PCRunEventLogRecord XMLToObject(string xml)
        {
            XmlRootAttribute xRoot = new XmlRootAttribute
            {
                ElementName = "RunEventLogRecord",
                IsNullable = true,
                //Namespace = PCConstants.PC_API_XMLNS,
            };

            XmlSerializer serializer = new XmlSerializer(typeof(PCRunEventLogRecord), xRoot);
            PCRunEventLogRecord pcRunEventLogRecord;
            using (StringReader reader = new StringReader(xml))
            {
                pcRunEventLogRecord = (PCRunEventLogRecord)serializer.Deserialize(reader);
            }
            return pcRunEventLogRecord;
        }

        public static PCRunEventLogRecord XMLToObject2(string xml)
        {
            Serializer serialzer = new Serializer();
            serialzer.SerXmlRootAttribute = new XmlRootAttribute
            {
                ElementName = "TestSet",
                IsNullable = true,
                //Namespace = PCConstants.PC_API_XMLNS,
            };
            return serialzer.Deserialize<PCRunEventLogRecord>(xml);
        }

    }

}