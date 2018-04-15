using System;
using System.IO;
using System.Xml;
using System.Xml.Serialization;
using PC.Plugins.Common.Helper;
using PC.Plugins.Common.Constants;



namespace PC.Plugins.Common.PCEntities
{
    [XmlRoot(Namespace = PCConstants.PC_API_XMLNS, ElementName = "Run", DataType = "string", IsNullable = true)]
    public class PCRunResponse //: PCRunRequest
	{
        [XmlIgnoreAttribute]
        private PCConstants.RunStates _runState;

        [XmlIgnoreAttribute]
        private PCConstants.PostRunActionValue _postRunAction;

        [XmlElement("TestID")]
        public int TestID
        {
            get; set;
        }

        [XmlElement("TestInstanceID")]
        public int TestInstanceID
        {
            get; set;
        }

        [XmlElement("PostRunAction")]
        public string PostRunAction
        {
            get { return EnumerationHelper.GetEnumDescription((PCConstants.PostRunActionValue)_postRunAction); }
            set { _postRunAction = EnumerationHelper.GetEnumFromDescription<PCConstants.PostRunActionValue>(value); }
        }

        [XmlElement("TimeslotID")]
        public int TimeslotID
        {
            get; set;
        }

        [XmlElement("VudsMode")]
        public bool VudsMode
        {
            get; set;
        }

        [XmlElement("ID")]
        public int ID
        {
            get; set;
        }
        [XmlElement("Duration")]
        public int Duration
        {
            get; set;
        }
        [XmlElement("RunState")]
        public string RunState
        {
            get { return EnumerationHelper.GetEnumDescription((PCConstants.RunStates)_runState); }
            set { _runState = EnumerationHelper.GetEnumFromDescription<PCConstants.RunStates>(value); }
        }
        [XmlElement("RunSLAStatus")]
        public string RunSLAStatus
        {
            get; set;
        }

        public static PCRunResponse XMLToObject(string xml)
        {
            XmlRootAttribute xRoot = new XmlRootAttribute
            {
                ElementName = "Run",
                IsNullable = true,
                Namespace = PCConstants.PC_API_XMLNS,
            };

            XmlSerializer serializer = new XmlSerializer(typeof(PCRunResponse), xRoot);
            PCRunResponse pcRunResponse;
            using (StringReader reader = new StringReader(xml))
            {
                pcRunResponse = (PCRunResponse)serializer.Deserialize(reader);
            }
            return pcRunResponse;
        }

        //could be problematic for empty values
        public static PCRunResponse XMLToObject2(string xml)
        {
            Serializer serialzer = new Serializer();
            serialzer.SerXmlRootAttribute = new XmlRootAttribute
            {
                ElementName = "Run",
                IsNullable = true,
                Namespace = PCConstants.PC_API_XMLNS,
            };
            return serialzer.Deserialize<PCRunResponse>(xml);
        }

    }

}