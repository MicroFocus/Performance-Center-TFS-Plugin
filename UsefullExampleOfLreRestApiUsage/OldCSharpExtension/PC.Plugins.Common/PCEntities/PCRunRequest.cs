using System;
using System.IO;
using System.Xml;
using System.Xml.Serialization;
using PC.Plugins.Common.Helper;
using PC.Plugins.Common.Constants;

namespace PC.Plugins.Common.PCEntities
{
    [XmlRoot(Namespace = PCConstants.PC_API_XMLNS, ElementName = "Run", DataType = "string", IsNullable = true)]
    public class PCRunRequest
    {

        [XmlIgnoreAttribute]
        private string _postRunAction;

        [XmlIgnoreAttribute]
        private int _testID;

        [XmlIgnoreAttribute]
        private int _testInstanceID;

        [XmlIgnoreAttribute]
        private PCTimeslotDuration _timeslotDuration;

        [XmlIgnoreAttribute]
        private bool _vudsMode;

        [XmlElement("PostRunAction")]
        public string PostRunAction
        {
            get { return _postRunAction; }
            set { _postRunAction = value; }
        }

        [XmlElement("TestID")]
        public int TestID
        {
            get { return _testID; }
            set { _testID = value; }
        }

        [XmlElement("TestInstanceID")]
        public int TestInstanceID
        {
            get { return _testInstanceID; }
            set { _testInstanceID = value; }
        }

        [XmlElement("TimeslotDuration")]
        public PCTimeslotDuration TimeslotDuration
        {
            get { return _timeslotDuration; }
            set { _timeslotDuration = value; }
        }

        [XmlElement("VudsMode")]
        public bool VudsMode
        {
            get { return _vudsMode; }
            set { _vudsMode = value; }
        }


        public PCRunRequest(int testID, int testInstanceID, PCTimeslotDuration timeslotDuration, string postRunAction, bool vudsMode)
		{

			this._testID = testID;
			this._testInstanceID = testInstanceID;
            this._timeslotDuration = timeslotDuration;
			this._postRunAction = postRunAction;
			this._vudsMode = vudsMode;
		}

		public PCRunRequest()
		{
		}


        public string ObjectToXml() => new Serializer().Serialize(this);
    }

}