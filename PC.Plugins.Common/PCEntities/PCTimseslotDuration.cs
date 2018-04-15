using System;
using System.IO;
using System.Xml;
using System.Xml.Serialization;
using PC.Plugins.Common.Helper;
using PC.Plugins.Common.Constants;

namespace PC.Plugins.Common.PCEntities
{

	public class PCTimeslotDuration
	{

        [XmlIgnoreAttribute]
        private int _hours;

        [XmlIgnoreAttribute]
        private int _minutes;

        [XmlElement("Hours")]
        public int Hours
        {
            get { return _hours; }
            set { _hours = value; }
        }

        [XmlElement("Minutes")]
        public int Minutes
        {
            get { return _minutes; }
            set { _minutes = value; }
        }

        public PCTimeslotDuration()
        {
        }

        public PCTimeslotDuration(int hours, int minutes)
		{
			this._hours = hours + minutes / 60;
			this._minutes = minutes % 60;
		}

		public PCTimeslotDuration(string hours, string minutes)
		{

			try
			{
				int m = int.Parse(minutes);
				int h = (string.IsNullOrWhiteSpace(hours))? 0 : int.Parse(hours) + m / 60;
				if (h < 480)
				{
					this._hours = h;
					this._minutes = m % 60;
				}
				else
				{
					this._hours = 480;
					this._minutes = 0;
				}
			}
			catch (Exception)
			{
				this._hours = 0;
				this._minutes = 0;
			}
		}

        public PCTimeslotDuration(int minutes) : this(0, minutes)
		{

		}


        public virtual int toMinutes() => _hours * 60 + _minutes;


        public override string ToString() => string.Format("{0:D}:{1:D2}(h:mm)", _hours, _minutes);


        public static PCTimeslotDuration XMLToObject(string xml)
        {
            XmlRootAttribute xRoot = new XmlRootAttribute
            {
                ElementName = "TimeslotDuration",
                IsNullable = true,
                //Namespace = PCConstants.PC_API_XMLNS,
            };

            XmlSerializer serializer = new XmlSerializer(typeof(PCTestSet), xRoot);
            PCTimeslotDuration timeslotDuration;
            using (StringReader reader = new StringReader(xml))
            {
                timeslotDuration = (PCTimeslotDuration)serializer.Deserialize(reader);
            }
            return timeslotDuration;
        }

        public static PCTimeslotDuration XMLToObject2(string xml)
        {
            Serializer serialzer = new Serializer();
            serialzer.SerXmlRootAttribute = new XmlRootAttribute
            {
                ElementName = "TimeslotDuration",
                IsNullable = true,
                //Namespace = PCConstants.PC_API_XMLNS,
            };
            return serialzer.Deserialize<PCTimeslotDuration>(xml);
        }


        public string ObjectToXml() => new Serializer().Serialize(this);

    }

}