using System.IO;
using System.Collections.Generic;
using System.Xml.Serialization;
using PC.Plugins.Common.Helper;
using PC.Plugins.Common.Constants;

namespace PC.Plugins.Common.PCEntities
{
    
    public class PCRunResult
	{

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

        [XmlElement("RunID")]
        public virtual int RunID
		{
            get; set;
        }

        [XmlElement("Type")]
        public virtual string Type
		{
            get; set;
        }

        public static PCRunResult XMLToObject(string xml)
        {
            XmlRootAttribute xRoot = new XmlRootAttribute
            {
                ElementName = "Run",
                IsNullable = true,
                //Namespace = PCConstants.PC_API_XMLNS,
            };

            XmlSerializer serializer = new XmlSerializer(typeof(PCTestSet), xRoot);
            PCRunResult pcRunResult;
            using (StringReader reader = new StringReader(xml))
            {
                pcRunResult = (PCRunResult)serializer.Deserialize(reader);
            }
            return pcRunResult;
        }

        public static PCRunResult XMLToObject2(string xml)
        {
            Serializer serialzer = new Serializer();
            serialzer.SerXmlRootAttribute = new XmlRootAttribute
            {
                ElementName = "Run",
                IsNullable = true,
                //Namespace = PCConstants.PC_API_XMLNS,
            };
            return serialzer.Deserialize<PCRunResult>(xml);
        }

    }
}