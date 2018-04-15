using System.IO;
using System.Collections.Generic;
using System.Xml.Serialization;
using PC.Plugins.Common.Helper;
using PC.Plugins.Common.Constants;

namespace PC.Plugins.Common.PCEntities
{

    /// <remarks/>
    [System.Xml.Serialization.XmlTypeAttribute(AnonymousType = true, Namespace = PCConstants.PC_API_XMLNS)]
    [System.Xml.Serialization.XmlRootAttribute(Namespace = PCConstants.PC_API_XMLNS, IsNullable = false)]
    public partial class PCTrendReport
    {

        private string nameField;

        private byte idField;

        private byte baselineIDField;

        private TrendReportTrendedRun[] trendedRunsField;

        /// <remarks/>
        public string Name
        {
            get
            {
                return this.nameField;
            }
            set
            {
                this.nameField = value;
            }
        }

        /// <remarks/>
        public byte ID
        {
            get
            {
                return this.idField;
            }
            set
            {
                this.idField = value;
            }
        }

        /// <remarks/>
        public byte BaselineID
        {
            get
            {
                return this.baselineIDField;
            }
            set
            {
                this.baselineIDField = value;
            }
        }

        /// <remarks/>
        [System.Xml.Serialization.XmlArrayItemAttribute("TrendedRun", IsNullable = false)]
        public TrendReportTrendedRun[] TrendedRuns
        {
            get
            {
                return this.trendedRunsField;
            }
            set
            {
                this.trendedRunsField = value;
            }
        }


        public static PCTrendReport XMLToObject(string xml)
        {
            XmlRootAttribute xRoot = new XmlRootAttribute
            {
                ElementName = "TrendReport",
                IsNullable = true,
                Namespace = PCConstants.PC_API_XMLNS,
            };

            XmlSerializer serializer = new XmlSerializer(typeof(PCTrendReport), xRoot);
            PCTrendReport pcTrendReport;
            using (StringReader reader = new StringReader(xml))
            {
                pcTrendReport = (PCTrendReport)serializer.Deserialize(reader);
            }
            return pcTrendReport;
        }

        //could be problematic for empty values
        public static PCTrendReport XMLToObject2(string xml)
        {
            Serializer serialzer = new Serializer();
            serialzer.SerXmlRootAttribute = new XmlRootAttribute
            {
                ElementName = "TrendReport",
                IsNullable = true,
                Namespace = PCConstants.PC_API_XMLNS,
            };

            return serialzer.Deserialize<PCTrendReport>(xml);
        }

    }

    /// <remarks/>
    [System.Xml.Serialization.XmlTypeAttribute(AnonymousType = true, Namespace = PCConstants.PC_API_XMLNS)]
    public partial class TrendReportTrendedRun
    {

        private byte runIDField;

        private System.DateTime runDateField;

        private string stateField;

        private byte durationField;

        private string fromTimeField;

        private string toTimeField;

        private string projectNameField;

        /// <remarks/>
        public byte RunID
        {
            get
            {
                return this.runIDField;
            }
            set
            {
                this.runIDField = value;
            }
        }

        /// <remarks/>
        public System.DateTime RunDate
        {
            get
            {
                return this.runDateField;
            }
            set
            {
                this.runDateField = value;
            }
        }

        /// <remarks/>
        public string State
        {
            get
            {
                return this.stateField;
            }
            set
            {
                this.stateField = value;
            }
        }

        /// <remarks/>
        public byte Duration
        {
            get
            {
                return this.durationField;
            }
            set
            {
                this.durationField = value;
            }
        }

        /// <remarks/>
        public string FromTime
        {
            get
            {
                return this.fromTimeField;
            }
            set
            {
                this.fromTimeField = value;
            }
        }

        /// <remarks/>
        public string ToTime
        {
            get
            {
                return this.toTimeField;
            }
            set
            {
                this.toTimeField = value;
            }
        }

        /// <remarks/>
        public string ProjectName
        {
            get
            {
                return this.projectNameField;
            }
            set
            {
                this.projectNameField = value;
            }
        }
    }


}
