using System.IO;
using System.Collections.Generic;
using System.Xml.Serialization;
using PC.Plugins.Common.Helper;
using PC.Plugins.Common.Constants;

namespace PC.Plugins.Common.PCEntities
{

    [XmlRoot(Namespace = PCConstants.PC_API_XMLNS, ElementName = "EventLog", DataType = "string", IsNullable = true)]
    public class PCRunEventLog
	{

		private List<PCRunEventLogRecord> _recordsList;

		public PCRunEventLog()
		{
            _recordsList = new List<PCRunEventLogRecord>();
		}

        [XmlElement("Record")]
        public virtual List<PCRunEventLogRecord> RecordsList
		{
            get { return _recordsList; }
            set { _recordsList = value; }
		}

        public static PCRunEventLog XMLToObject(string xml)
        {
            XmlSerializer serializer = new XmlSerializer(typeof(PCRunEventLog));
            PCRunEventLog pcRunEventLog;
            using (StringReader reader = new StringReader(xml))
            {
                pcRunEventLog = (PCRunEventLog)serializer.Deserialize(reader);
            }
            return pcRunEventLog;
        }

        //could be problematic for empty values
        public static PCRunEventLog XMLToObject2(string xml)
        {
            Serializer serialzer = new Serializer();
            serialzer.SerXmlRootAttribute = new XmlRootAttribute
            {
                ElementName = "RunEventLog",
                IsNullable = true,
                Namespace = PCConstants.PC_API_XMLNS,
            };

            return serialzer.Deserialize<PCRunEventLog>(xml);
        }


    }

}