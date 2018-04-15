using System.IO;
using System.Collections.Generic;
using System.Xml.Serialization;
using PC.Plugins.Common.Helper;
using PC.Plugins.Common.Constants;


namespace PC.Plugins.Common.PCEntities
{
    [XmlRoot(Namespace = PCConstants.PC_API_XMLNS, ElementName = "TestInstances", DataType = "string", IsNullable = true)]
    public class PCTestInstances
	{

		private List<PCTestInstance> _testInstancesList;

		public PCTestInstances()
		{
			_testInstancesList = new List<PCTestInstance>();
		}


        [XmlElement("TestInstance")]
        public List<PCTestInstance> TestInstancesList
		{
			get { return _testInstancesList; }
            set { _testInstancesList = value; }
        }

        public static PCTestInstances XMLToObject(string xml)
        {
            XmlSerializer serializer = new XmlSerializer(typeof(PCTestInstances));
            PCTestInstances pcTestInstances;
            using (StringReader reader = new StringReader(xml))
            {
                pcTestInstances = (PCTestInstances)serializer.Deserialize(reader);
            }
            return pcTestInstances;
        }

        //could be problematic for empty values
        public static PCTestInstances XMLToObject2(string xml)
        {
            Serializer serialzer = new Serializer();
            serialzer.SerXmlRootAttribute = new XmlRootAttribute
            {
                ElementName = "TestInstances",
                IsNullable = true,
                Namespace = PCConstants.PC_API_XMLNS,
            };

            return serialzer.Deserialize<PCTestInstances>(xml);
        }
    }

}