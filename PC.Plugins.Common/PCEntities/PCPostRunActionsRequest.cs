using System;
using System.IO;
using System.Xml;
using System.Xml.Serialization;
using PC.Plugins.Common.Helper;
using PC.Plugins.Common.Constants;

namespace PC.Plugins.Common.PCEntities
{

    [XmlRoot(Namespace = PCConstants.PC_API_XMLNS, ElementName = "PostRunActions", DataType = "string", IsNullable = true)]
    public class PCPostRunActionsRequest
    {

        [XmlIgnoreAttribute]
        private bool _releaseTimeslot;

        [XmlIgnoreAttribute]
        private PCConstants.PostRunActionValue _postRunAction;

        /// <summary>
        /// Initializes a new instance of the PostRunActionsRequest with ReleaseTimeslot=true and PostRunAction="Collate Results"
        /// </summary>
        public PCPostRunActionsRequest()
        {
            _releaseTimeslot = true;
            _postRunAction = PCConstants.PostRunActionValue.CollateResults;
        }

        /// <summary>
        /// Initializes a new instance of the PostRunActionsRequest with releaseTimeslot=boolValue and postRunAction= string of member's description or member (in catch) of PCConstants.PostRunActionValue.
        /// </summary>
        public PCPostRunActionsRequest(bool releaseTimeslot, string postRunAction)
        {
            _releaseTimeslot = releaseTimeslot;
            try
            {
                _postRunAction = EnumerationHelper.GetEnumFromDescription<PCConstants.PostRunActionValue>(postRunAction);
            }
            catch
            {
                _postRunAction = (PCConstants.PostRunActionValue)Enum.Parse(typeof(PCConstants.PostRunActionValue), postRunAction);
            }
        }

        [XmlElement("ReleaseTimeslot")]
        public virtual bool ReleaseTimeslot
        {
            get { return _releaseTimeslot; }
            set { _releaseTimeslot = value; }
        }

        [XmlElement("PostRunAction")]
        public string PostRunAction
        {
            get { return EnumerationHelper.GetEnumDescription(_postRunAction); }
            set { _postRunAction = EnumerationHelper.GetEnumFromDescription<PCConstants.PostRunActionValue>(value); }
        }

        public PCPostRunActionsRequest XMLToObject(string xml)
        {
            XmlRootAttribute xRoot = new XmlRootAttribute
            {
                ElementName = "PostRunActions",
                IsNullable = true,
                Namespace = PCConstants.PC_API_XMLNS,
            };

            XmlSerializer serializer = new XmlSerializer(typeof(PCPostRunActionsRequest), xRoot);
            PCPostRunActionsRequest postRunActions;
            using (StringReader reader = new StringReader(xml))
            {
                postRunActions = (PCPostRunActionsRequest)serializer.Deserialize(reader);
            }
            return postRunActions;
        }

        //could be problematic for empty values
        public PCPostRunActionsRequest XMLToObject2(string xml)
        {
            Serializer serialzer = new Serializer();
            serialzer.SerXmlRootAttribute = new XmlRootAttribute
            {
                ElementName = "PostRunActions",
                IsNullable = true,
                Namespace = PCConstants.PC_API_XMLNS,
            };
            return serialzer.Deserialize<PCPostRunActionsRequest>(xml);
        }

        public string ObjectToXml() => new Serializer().Serialize(this);



    }
}