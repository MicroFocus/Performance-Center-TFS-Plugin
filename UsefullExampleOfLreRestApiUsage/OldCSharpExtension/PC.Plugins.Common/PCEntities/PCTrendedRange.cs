using System;
using System.IO;
using System.Xml;
using System.Xml.Serialization;
using PC.Plugins.Common.Helper;
using PC.Plugins.Common.Constants;

namespace PC.Plugins.Common.PCEntities
{

	public class PCTrendedRange
	{
		private PCTimeInterval _startTime;
		private PCTimeInterval _endTime;


        [XmlElement("StartTime")]
        public PCTimeInterval StartTime
        {
            get { return _startTime; }
            set { _startTime = value; }
        }

        [XmlElement("EndTime")]
        public PCTimeInterval EndTime
        {
            get { return _endTime; }
            set { _endTime = value; }
        }

        public PCTrendedRange(PCTimeInterval startTime, PCTimeInterval endTime)
		{
			this._startTime = startTime;
			this._endTime = endTime;
		}

        public PCTrendedRange()
        {
        }



	}

}