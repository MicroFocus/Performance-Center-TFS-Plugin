using System;
using System.IO;
using System.Xml;
using System.Xml.Serialization;
using PC.Plugins.Common.Helper;
using PC.Plugins.Common.Constants;


namespace PC.Plugins.Common.PCEntities
{
    [XmlRoot(Namespace = PCConstants.PC_API_XMLNS, ElementName = "TestInstance", DataType = "string", IsNullable = true)]
    public class PCTestInstanceRequest
	{
        [XmlIgnoreAttribute]
        private int _testID;

        [XmlIgnoreAttribute]
        private int _testSetID;


        public PCTestInstanceRequest()
        {
        }

        public PCTestInstanceRequest(int testID, int testSetID)
        {
            _testID = testID;
            _testSetID = testSetID;
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

        public string ObjectToXml() => new Serializer().Serialize(this);

    }
}