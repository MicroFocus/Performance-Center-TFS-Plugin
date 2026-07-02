using System;
using System.IO;
using System.Xml;
using System.Xml.Serialization;
using PC.Plugins.Common.Helper;
using PC.Plugins.Common.Constants;


namespace PC.Plugins.Common.PCEntities
{
    [XmlRoot(Namespace = PCConstants.PC_API_XMLNS, ElementName = "TestInstance", DataType = "string", IsNullable = true)]
    public class PCTestInstanceResponse
	{
        [XmlIgnoreAttribute]
        private int _testID;

        [XmlIgnoreAttribute]
        private int _testSetID;

        [XmlIgnoreAttribute]
        private int _testInstanceID;

        public PCTestInstanceResponse()
        {
        }

        [XmlElement("TestID")]
        public int TestID
        {
            get { return _testID; }
            set { _testID = value; }
        }

        [XmlElement("TestSetID")]
        public int TestSetID
        {
            get { return _testSetID; }
            set { _testSetID = value; }
        }

        [XmlElement("TestInstanceID")]
        public int TestInstanceID
        {
            get { return _testInstanceID; }
            set { _testInstanceID = value; }
        }

        public virtual string objectToXML() => Client.Utils.CreateXML(this);

        public static PCTestInstanceResponse XMLToObject(string xml)
        {
            XmlRootAttribute xRoot = new XmlRootAttribute
            {
                ElementName = "TestInstance",
                IsNullable = true,
                Namespace = PCConstants.PC_API_XMLNS,
            };

            XmlSerializer serializer = new XmlSerializer(typeof(PCTestInstanceResponse), xRoot);
            PCTestInstanceResponse testInstanceResponse;
            using (StringReader reader = new StringReader(xml))
            {
                testInstanceResponse = (PCTestInstanceResponse)serializer.Deserialize(reader);
            }
            return testInstanceResponse;
        }

        //could be problematic for empty values
        public static PCTestInstanceResponse XMLToObject2(string xml)
        {
            Serializer serialzer = new Serializer();
            serialzer.SerXmlRootAttribute = new XmlRootAttribute
            {
                ElementName = "TestInstance",
                IsNullable = true,
                Namespace = PCConstants.PC_API_XMLNS,
            };
            return serialzer.Deserialize<PCTestInstanceResponse>(xml);
        }


        public string ObjectToXml()
        {
            XmlSerializer serializer = new XmlSerializer(this.GetType());
            XmlWriterSettings settings = new XmlWriterSettings();
            settings.Indent = true;
            settings.OmitXmlDeclaration = true;

            using (StringWriter stream = new StringWriter())
            using (XmlWriter writer = XmlWriter.Create(stream, settings))
            {
                XmlSerializerNamespaces namepSpaces = new XmlSerializerNamespaces(new[] { XmlQualifiedName.Empty });
                namepSpaces.Add("", "PCConstants.PC_API_XMLNS");
                serializer.Serialize(writer, this, namepSpaces);
                return stream.ToString();
            }
        }

        //could be problematic for empty values
        public string ObjectToXml2() => new Serializer().Serialize(this);



    }
}