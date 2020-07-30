using System.IO;
using System.Collections.Generic;
using System.Xml.Serialization;
using PC.Plugins.Common.Helper;
using PC.Plugins.Common.Constants;
using System;

namespace PC.Plugins.Common.PCEntities
{

    /// <remarks/>
    [System.Xml.Serialization.XmlTypeAttribute(AnonymousType = true, Namespace = PCConstants.PC_API_XMLNS)]
    [System.Xml.Serialization.XmlRootAttribute(Namespace = PCConstants.PC_API_XMLNS, IsNullable = false)]
    public partial class PCTrendReport
    {

        private string nameField;

        private int idField;

        private int baselineIDField;

        private List<TrendReportTrendedRun> trendedRunsField;

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
        public int ID
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
        public int BaselineID
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
        public List<TrendReportTrendedRun> TrendedRuns
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

        private int runIDField;

        private DateTime runDateField;

        private string stateField;

        private int durationField;

        private string fromTimeField;

        private string toTimeField;

        private string projectNameField;

        /// <remarks/>
        public int RunID
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
        public DateTime RunDate
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
        public int Duration
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
