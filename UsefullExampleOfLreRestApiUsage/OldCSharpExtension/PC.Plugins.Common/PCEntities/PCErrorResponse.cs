using System.IO;
using System.Collections.Generic;
using System.Xml.Serialization;
using PC.Plugins.Common.Helper;
using PC.Plugins.Common.Constants;

namespace PC.Plugins.Common.PCEntities
{

    [XmlRoot(Namespace = PCConstants.PC_API_XMLNS, ElementName = "Exception", DataType = "string", IsNullable = true)]
    public class PCErrorResponse
	{
        [XmlIgnoreAttribute]
        private string _exceptionMessage;

        [XmlIgnoreAttribute]
        private int _errorCode;

        [XmlElement("ExceptionMessage")]
        public string ExceptionMessage
        {
            get { return _exceptionMessage; }
            set { _exceptionMessage = value; }
        }

        [XmlElement("ErrorCode")]
        public int ErrorCode
        {
            get { return _errorCode; }
            set { _errorCode = value; }
        }

        public PCErrorResponse(string exceptionMessage, int errorCode)
		{
			ExceptionMessage = exceptionMessage;
			ErrorCode = errorCode;
		}

        public PCErrorResponse()
        {
        }

        public static PCErrorResponse XMLToObject(string xml)
        {
            XmlSerializer serializer = new XmlSerializer(typeof(PCErrorResponse));
            PCErrorResponse pcErrorResponse;
            using (StringReader reader = new StringReader(xml))
            {
                pcErrorResponse = (PCErrorResponse)serializer.Deserialize(reader);
            }
            return pcErrorResponse;
        }

        //could be problematic for empty values
        public static PCErrorResponse XMLToObject2(string xml)
        {
            Serializer serialzer = new Serializer();
            serialzer.SerXmlRootAttribute = new XmlRootAttribute
            {
                ElementName = "Exception",
                IsNullable = true,
                Namespace = PCConstants.PC_API_XMLNS,
            };

            return serialzer.Deserialize<PCErrorResponse>(xml);
        }

    }

}