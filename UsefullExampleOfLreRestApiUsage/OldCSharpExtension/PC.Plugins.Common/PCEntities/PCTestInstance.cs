using System.IO;
using System.Xml;
using System.Xml.Serialization;
using PC.Plugins.Common.Helper;
using PC.Plugins.Common.Constants;

namespace PC.Plugins.Common.PCEntities
{

	public class PCTestInstance
	{
		
        [XmlElement("TestInstanceID")]
        public int TestInstanceID
        {
            get; set;
        }

        [XmlElement("TestID")]
        public int TestID
        {
            get; set;
        }
        [XmlElement("TestSetId")]
        public virtual int TestSetId
        {
            get; set;
		}

        public static PCTestInstance XMLToObject(string xml)
        {
            XmlRootAttribute xRoot = new XmlRootAttribute
            {
                ElementName = "TestInstance",
                IsNullable = true,
                //Namespace = PCConstants.PC_API_XMLNS,
            };

            XmlSerializer serializer = new XmlSerializer(typeof(PCTestInstance), xRoot);
            PCTestInstance pcTestInstance;
            using (StringReader reader = new StringReader(xml))
            {
                pcTestInstance = (PCTestInstance)serializer.Deserialize(reader);
            }
            return pcTestInstance;
        }

        //could be problematic for empty values
        public static PCTestInstance XMLToObject2(string xml)
        {
            Serializer serialzer = new Serializer();
            serialzer.SerXmlRootAttribute = new XmlRootAttribute
            {
                ElementName = "TestInstance",
                IsNullable = true,
                //Namespace = PCConstants.PC_API_XMLNS,
            };
            return serialzer.Deserialize<PCTestInstance>(xml);
        }


        

    }

}