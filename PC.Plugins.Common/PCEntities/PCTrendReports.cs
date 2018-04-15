using System.IO;
using System.Xml.Serialization;
using PC.Plugins.Common.Helper;
using PC.Plugins.Common.Constants;

namespace PC.Plugins.Common.PCEntities
{
    /// <remarks/>
    [System.Xml.Serialization.XmlTypeAttribute(AnonymousType = true, Namespace = PCConstants.PC_API_XMLNS)]
    [System.Xml.Serialization.XmlRootAttribute(Namespace = PCConstants.PC_API_XMLNS, IsNullable = false)]
    public partial class PCTrendReports
    {

        private TrendReportsTrendReport[] trendReportField;

        /// <remarks/>
        [System.Xml.Serialization.XmlElementAttribute("TrendReport")]
        public TrendReportsTrendReport[] TrendReport
        {
            get
            {
                return this.trendReportField;
            }
            set
            {
                this.trendReportField = value;
            }
        }

        public static PCTrendReports XMLToObject(string xml)
        {
            XmlRootAttribute xRoot = new XmlRootAttribute
            {
                ElementName = "TrendReports",
                IsNullable = true,
                Namespace = PCConstants.PC_API_XMLNS,
            };

            XmlSerializer serializer = new XmlSerializer(typeof(PCTrendReports), xRoot);
            PCTrendReports trendReports;
            using (StringReader reader = new StringReader(xml))
            {
                trendReports = (PCTrendReports)serializer.Deserialize(reader);
            }
            return trendReports;
        }

        public static PCTrendReports XMLToObject2(string xml)
        {
            Serializer serialzer = new Serializer();
            serialzer.SerXmlRootAttribute = new XmlRootAttribute
            {
                ElementName = "TestSet",
                IsNullable = true,
                //Namespace = PCConstants.PC_API_XMLNS,
            };
            return serialzer.Deserialize<PCTrendReports>(xml);
        }

    }

    /// <remarks/>
    [System.Xml.Serialization.XmlTypeAttribute(AnonymousType = true, Namespace = PCConstants.PC_API_XMLNS)]
    public partial class TrendReportsTrendReport
    {

        private string nameField;

        private byte idField;

        private byte baselineIDField;

        private TrendReportsTrendReportTrendedRun[] trendedRunsField;

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
        public TrendReportsTrendReportTrendedRun[] TrendedRuns
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
    }

    /// <remarks/>
    [System.Xml.Serialization.XmlTypeAttribute(AnonymousType = true, Namespace = PCConstants.PC_API_XMLNS)]
    public partial class TrendReportsTrendReportTrendedRun
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