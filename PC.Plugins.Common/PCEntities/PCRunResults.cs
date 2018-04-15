using System;
using System.IO;
using System.Collections.Generic;
using System.Xml.Serialization;
using PC.Plugins.Common.Helper;
using PC.Plugins.Common.Constants;

namespace PC.Plugins.Common.PCEntities
{
    [XmlRoot(Namespace = PCConstants.PC_API_XMLNS, ElementName = "RunResults", DataType = "string", IsNullable = true)]
    public class PCRunResults
	{
        
        private List<PCRunResult> _resultsList;

		public PCRunResults()
		{
			_resultsList = new List<PCRunResult>();
		}

        [XmlElement("RunResult")]
        public virtual List<PCRunResult> ResultsList
		{
			get	{ return _resultsList; }
            set { _resultsList=value; }
        }


        public static PCRunResults XMLToObject(string xml)
        {
            try
            {
                if (!string.IsNullOrWhiteSpace(xml))
                {
                    XmlSerializer serializer = new XmlSerializer(typeof(PCRunResults));
                    PCRunResults pcRunResults;
                    using (StringReader reader = new StringReader(xml))
                    {
                        pcRunResults = (PCRunResults)serializer.Deserialize(reader);
                    }
                    return pcRunResults;
                }
                else
                    return null;
            }
            catch //(Exception ex)
            {
                return null;
            }
        }

        //could be problematic for empty values
        public static PCRunResults XMLToObject2(string xml)
        {
            Serializer serialzer = new Serializer();
            serialzer.SerXmlRootAttribute = new XmlRootAttribute
            {
                ElementName = "Runs",
                IsNullable = true,
                Namespace = PCConstants.PC_API_XMLNS,
            };

            return serialzer.Deserialize<PCRunResults>(xml);
        }
    }
}