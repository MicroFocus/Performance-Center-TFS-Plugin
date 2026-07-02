using System.IO;
using System.Collections.Generic;
using System.Xml.Serialization;
using PC.Plugins.Common.Helper;
using PC.Plugins.Common.Constants;


namespace PC.Plugins.Common.PCEntities
{
    [XmlRoot(Namespace = PCConstants.PC_API_XMLNS, ElementName = "TestSets", DataType = "string", IsNullable = true)]
    public class PCTestSets
	{
		private List<PCTestSet> _pcTestSetsList;

        public PCTestSets()
        {
            _pcTestSetsList = new List<PCTestSet>();
        }

        [XmlElement("TestSet")]
        public List<PCTestSet> PCTestSetsList
		{
            get { return _pcTestSetsList; }
            set { _pcTestSetsList = value; }
        }

        public static PCTestSets XMLToObject(string xml)
        {
            XmlSerializer serializer = new XmlSerializer(typeof(PCTestSets));
            PCTestSets pcTestSets;
            using (StringReader reader = new StringReader(xml))
            {
                pcTestSets = (PCTestSets)serializer.Deserialize(reader);
            }
            return pcTestSets;
        }

        //could be problematic for empty values
        public static PCTestSets XMLToObject2(string xml)
        {
            Serializer serialzer = new Serializer();
            serialzer.SerXmlRootAttribute = new XmlRootAttribute
            {
                ElementName = "TestSets",
                IsNullable = true,
                Namespace = PCConstants.PC_API_XMLNS,
            };

            return serialzer.Deserialize<PCTestSets>(xml);
        }

    }

}