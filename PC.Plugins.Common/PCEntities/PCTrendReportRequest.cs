using System;
using System.IO;
using System.Xml;
using System.Xml.Serialization;
using PC.Plugins.Common.Helper;
using PC.Plugins.Common.Constants;

namespace PC.Plugins.Common.PCEntities
{

    [XmlRoot(Namespace = PCConstants.PC_API_XMLNS, ElementName = "TrendReport", DataType = "string", IsNullable = true)]
    public class PCTrendReportRequest
	{

		//private string xmlns = PCRestProxy.PC_API_XMLNS;

		private string _project;
		private int _runId;
		private PCTrendedRange _trandedRange;


        [XmlElement("Project")]
        public string Project
        {
            get { return _project; }
            set { _project = value; }
        }

        [XmlElement("RunId")]
        public int RunId
        {
            get { return _runId; }
            set { _runId = value; }
        }

        [XmlElement("TrandedRange")]
        public PCTrendedRange TrandedRange
        {
            get { return _trandedRange; }
            set { _trandedRange = value; }
        }


        public PCTrendReportRequest(string project, int runId, PCTrendedRange trandedRange)
		{
			this._project = project;
			this._runId = runId;
			this._trandedRange = trandedRange;
		}


        public PCTrendReportRequest()
        {

        }

        public static PCTrendReportRequest XMLToObject(string xml)
        {
            XmlRootAttribute xRoot = new XmlRootAttribute
            {
                ElementName = "TrendReport",
                IsNullable = true,
                Namespace = PCConstants.PC_API_XMLNS,
            };

            XmlSerializer serializer = new XmlSerializer(typeof(PCTrendReportRequest), xRoot);
            PCTrendReportRequest trendReportRequest;
            using (StringReader reader = new StringReader(xml))
            {
                trendReportRequest = (PCTrendReportRequest)serializer.Deserialize(reader);
            }
            return trendReportRequest;
        }

        //could be problematic for empty values
        public static PCTrendReportRequest XMLToObject2(string xml)
        {
            Serializer serialzer = new Serializer();
            serialzer.SerXmlRootAttribute = new XmlRootAttribute
            {
                ElementName = "TrendReport",
                IsNullable = true,
                Namespace = PCConstants.PC_API_XMLNS,
            };
            return serialzer.Deserialize<PCTrendReportRequest>(xml);
        }

        public string ObjectToXml() => new Serializer().Serialize(this);

    }

}