using System;
using System.IO;
using System.Xml;
using System.Xml.Serialization;
using PC.Plugins.Common.Helper;
using PC.Plugins.Common.Constants;

namespace PC.Plugins.Common.PCEntities
{

	public class PCTimeInterval
	{
		private int _days;
		private int _hours;
		private int _minutes;
		private int _seconds;


		public PCTimeInterval(int days, int hours, int minutes, int seconds)
		{
			this._days = days;
			this._hours = hours;
			this._minutes = minutes;
			this._seconds = seconds;

		}

        public PCTimeInterval()
        {
            
        }

        [XmlElement("Days")]
        public virtual int Days
		{
			get { return _days; }
            set { _days = value; }
		}

        [XmlElement("Hours")]
        public virtual int Hours
		{
			get { return _hours; }
            set { _hours = value; }
        }

        [XmlElement("Minutes")]
        public virtual int Minutes
		{
			get { return _minutes; }
            set { _minutes = value; }
        }

        [XmlElement("Seconds")]
        public virtual int Seconds
		{
			get { return _seconds; }
            set { _seconds = value; }
        }
	}

}