using System.IO;
using System.Xml.Serialization;
using PC.Plugins.Common.Helper;
//using PC.Plugins.Common.Constants;


namespace PC.Plugins.Common.PCEntities
{

    /// <remarks/>
    [System.Xml.Serialization.XmlTypeAttribute(AnonymousType = true)]
    [System.Xml.Serialization.XmlRootAttribute(Namespace = "", IsNullable = false)]
    public partial class PCTrendReportRoot
    {

        private RootTransactionsDataRow[] transactionsDataField;

        private RootRegularDataRow[] regularDataField;

        /// <remarks/>
        [System.Xml.Serialization.XmlArrayItemAttribute("TransactionsDataRow", IsNullable = false)]
        public RootTransactionsDataRow[] TransactionsData
        {
            get
            {
                return this.transactionsDataField;
            }
            set
            {
                this.transactionsDataField = value;
            }
        }

        /// <remarks/>
        [System.Xml.Serialization.XmlArrayItemAttribute("RegularDataRow", IsNullable = false)]
        public RootRegularDataRow[] RegularData
        {
            get
            {
                return this.regularDataField;
            }
            set
            {
                this.regularDataField = value;
            }
        }

        public static PCTrendReportRoot XMLToObject(string xml)
        {
            XmlRootAttribute xRoot = new XmlRootAttribute
            {
                ElementName = "Root",
                IsNullable = true,
                //Namespace = PCConstants.PC_API_XMLNS,
            };

            XmlSerializer serializer = new XmlSerializer(typeof(PCTrendReportRoot), xRoot);
            PCTrendReportRoot trendReportRoot;
            using (StringReader reader = new StringReader(xml))
            {
                trendReportRoot = (PCTrendReportRoot)serializer.Deserialize(reader);
            }
            return trendReportRoot;
        }

        public static PCTrendReportRoot XMLToObject2(string xml)
        {
            Serializer serialzer = new Serializer();
            serialzer.SerXmlRootAttribute = new XmlRootAttribute
            {
                ElementName = "TestSet",
                IsNullable = true,
                //Namespace = PCConstants.PC_API_XMLNS,
            };
            return serialzer.Deserialize<PCTrendReportRoot>(xml);
        }
    }

    /// <remarks/>
    [System.Xml.Serialization.XmlTypeAttribute(AnonymousType = true)]
    public partial class RootTransactionsDataRow
    {

        private string pCT_TYPEField;

        private string pCT_NAMEField;

        private ushort pCT_MINIMUMField;

        private decimal pCT_MAXIMUMField;

        private decimal pCT_AVERAGEField;

        private decimal pCT_MEDIANField;

        private decimal pCT_STDDEVIATIONField;

        private ushort pCT_COUNT1Field;

        private bool pCT_COUNT1FieldSpecified;

        private decimal pCT_SUM1Field;

        private bool pCT_SUM1FieldSpecified;

        private decimal pCT_PERCENTILE_25Field;

        private bool pCT_PERCENTILE_25FieldSpecified;

        private decimal pCT_PERCENTILE_75Field;

        private bool pCT_PERCENTILE_75FieldSpecified;

        private decimal pCT_PERCENTILE_90Field;

        private bool pCT_PERCENTILE_90FieldSpecified;

        private decimal pCT_PERCENTILE_91Field;

        private bool pCT_PERCENTILE_91FieldSpecified;

        private decimal pCT_PERCENTILE_92Field;

        private bool pCT_PERCENTILE_92FieldSpecified;

        private decimal pCT_PERCENTILE_93Field;

        private bool pCT_PERCENTILE_93FieldSpecified;

        private decimal pCT_PERCENTILE_94Field;

        private bool pCT_PERCENTILE_94FieldSpecified;

        private decimal pCT_PERCENTILE_95Field;

        private bool pCT_PERCENTILE_95FieldSpecified;

        private decimal pCT_PERCENTILE_96Field;

        private bool pCT_PERCENTILE_96FieldSpecified;

        private decimal pCT_PERCENTILE_97Field;

        private bool pCT_PERCENTILE_97FieldSpecified;

        private decimal pCT_PERCENTILE_98Field;

        private bool pCT_PERCENTILE_98FieldSpecified;

        private decimal pCT_PERCENTILE_99Field;

        private bool pCT_PERCENTILE_99FieldSpecified;

        /// <remarks/>
        public string PCT_TYPE
        {
            get
            {
                return this.pCT_TYPEField;
            }
            set
            {
                this.pCT_TYPEField = value;
            }
        }

        /// <remarks/>
        public string PCT_NAME
        {
            get
            {
                return this.pCT_NAMEField;
            }
            set
            {
                this.pCT_NAMEField = value;
            }
        }

        /// <remarks/>
        public ushort PCT_MINIMUM
        {
            get
            {
                return this.pCT_MINIMUMField;
            }
            set
            {
                this.pCT_MINIMUMField = value;
            }
        }

        /// <remarks/>
        public decimal PCT_MAXIMUM
        {
            get
            {
                return this.pCT_MAXIMUMField;
            }
            set
            {
                this.pCT_MAXIMUMField = value;
            }
        }

        /// <remarks/>
        public decimal PCT_AVERAGE
        {
            get
            {
                return this.pCT_AVERAGEField;
            }
            set
            {
                this.pCT_AVERAGEField = value;
            }
        }

        /// <remarks/>
        public decimal PCT_MEDIAN
        {
            get
            {
                return this.pCT_MEDIANField;
            }
            set
            {
                this.pCT_MEDIANField = value;
            }
        }

        /// <remarks/>
        public decimal PCT_STDDEVIATION
        {
            get
            {
                return this.pCT_STDDEVIATIONField;
            }
            set
            {
                this.pCT_STDDEVIATIONField = value;
            }
        }

        /// <remarks/>
        public ushort PCT_COUNT1
        {
            get
            {
                return this.pCT_COUNT1Field;
            }
            set
            {
                this.pCT_COUNT1Field = value;
            }
        }

        /// <remarks/>
        [System.Xml.Serialization.XmlIgnoreAttribute()]
        public bool PCT_COUNT1Specified
        {
            get
            {
                return this.pCT_COUNT1FieldSpecified;
            }
            set
            {
                this.pCT_COUNT1FieldSpecified = value;
            }
        }

        /// <remarks/>
        public decimal PCT_SUM1
        {
            get
            {
                return this.pCT_SUM1Field;
            }
            set
            {
                this.pCT_SUM1Field = value;
            }
        }

        /// <remarks/>
        [System.Xml.Serialization.XmlIgnoreAttribute()]
        public bool PCT_SUM1Specified
        {
            get
            {
                return this.pCT_SUM1FieldSpecified;
            }
            set
            {
                this.pCT_SUM1FieldSpecified = value;
            }
        }

        /// <remarks/>
        public decimal PCT_PERCENTILE_25
        {
            get
            {
                return this.pCT_PERCENTILE_25Field;
            }
            set
            {
                this.pCT_PERCENTILE_25Field = value;
            }
        }

        /// <remarks/>
        [System.Xml.Serialization.XmlIgnoreAttribute()]
        public bool PCT_PERCENTILE_25Specified
        {
            get
            {
                return this.pCT_PERCENTILE_25FieldSpecified;
            }
            set
            {
                this.pCT_PERCENTILE_25FieldSpecified = value;
            }
        }

        /// <remarks/>
        public decimal PCT_PERCENTILE_75
        {
            get
            {
                return this.pCT_PERCENTILE_75Field;
            }
            set
            {
                this.pCT_PERCENTILE_75Field = value;
            }
        }

        /// <remarks/>
        [System.Xml.Serialization.XmlIgnoreAttribute()]
        public bool PCT_PERCENTILE_75Specified
        {
            get
            {
                return this.pCT_PERCENTILE_75FieldSpecified;
            }
            set
            {
                this.pCT_PERCENTILE_75FieldSpecified = value;
            }
        }

        /// <remarks/>
        public decimal PCT_PERCENTILE_90
        {
            get
            {
                return this.pCT_PERCENTILE_90Field;
            }
            set
            {
                this.pCT_PERCENTILE_90Field = value;
            }
        }

        /// <remarks/>
        [System.Xml.Serialization.XmlIgnoreAttribute()]
        public bool PCT_PERCENTILE_90Specified
        {
            get
            {
                return this.pCT_PERCENTILE_90FieldSpecified;
            }
            set
            {
                this.pCT_PERCENTILE_90FieldSpecified = value;
            }
        }

        /// <remarks/>
        public decimal PCT_PERCENTILE_91
        {
            get
            {
                return this.pCT_PERCENTILE_91Field;
            }
            set
            {
                this.pCT_PERCENTILE_91Field = value;
            }
        }

        /// <remarks/>
        [System.Xml.Serialization.XmlIgnoreAttribute()]
        public bool PCT_PERCENTILE_91Specified
        {
            get
            {
                return this.pCT_PERCENTILE_91FieldSpecified;
            }
            set
            {
                this.pCT_PERCENTILE_91FieldSpecified = value;
            }
        }

        /// <remarks/>
        public decimal PCT_PERCENTILE_92
        {
            get
            {
                return this.pCT_PERCENTILE_92Field;
            }
            set
            {
                this.pCT_PERCENTILE_92Field = value;
            }
        }

        /// <remarks/>
        [System.Xml.Serialization.XmlIgnoreAttribute()]
        public bool PCT_PERCENTILE_92Specified
        {
            get
            {
                return this.pCT_PERCENTILE_92FieldSpecified;
            }
            set
            {
                this.pCT_PERCENTILE_92FieldSpecified = value;
            }
        }

        /// <remarks/>
        public decimal PCT_PERCENTILE_93
        {
            get
            {
                return this.pCT_PERCENTILE_93Field;
            }
            set
            {
                this.pCT_PERCENTILE_93Field = value;
            }
        }

        /// <remarks/>
        [System.Xml.Serialization.XmlIgnoreAttribute()]
        public bool PCT_PERCENTILE_93Specified
        {
            get
            {
                return this.pCT_PERCENTILE_93FieldSpecified;
            }
            set
            {
                this.pCT_PERCENTILE_93FieldSpecified = value;
            }
        }

        /// <remarks/>
        public decimal PCT_PERCENTILE_94
        {
            get
            {
                return this.pCT_PERCENTILE_94Field;
            }
            set
            {
                this.pCT_PERCENTILE_94Field = value;
            }
        }

        /// <remarks/>
        [System.Xml.Serialization.XmlIgnoreAttribute()]
        public bool PCT_PERCENTILE_94Specified
        {
            get
            {
                return this.pCT_PERCENTILE_94FieldSpecified;
            }
            set
            {
                this.pCT_PERCENTILE_94FieldSpecified = value;
            }
        }

        /// <remarks/>
        public decimal PCT_PERCENTILE_95
        {
            get
            {
                return this.pCT_PERCENTILE_95Field;
            }
            set
            {
                this.pCT_PERCENTILE_95Field = value;
            }
        }

        /// <remarks/>
        [System.Xml.Serialization.XmlIgnoreAttribute()]
        public bool PCT_PERCENTILE_95Specified
        {
            get
            {
                return this.pCT_PERCENTILE_95FieldSpecified;
            }
            set
            {
                this.pCT_PERCENTILE_95FieldSpecified = value;
            }
        }

        /// <remarks/>
        public decimal PCT_PERCENTILE_96
        {
            get
            {
                return this.pCT_PERCENTILE_96Field;
            }
            set
            {
                this.pCT_PERCENTILE_96Field = value;
            }
        }

        /// <remarks/>
        [System.Xml.Serialization.XmlIgnoreAttribute()]
        public bool PCT_PERCENTILE_96Specified
        {
            get
            {
                return this.pCT_PERCENTILE_96FieldSpecified;
            }
            set
            {
                this.pCT_PERCENTILE_96FieldSpecified = value;
            }
        }

        /// <remarks/>
        public decimal PCT_PERCENTILE_97
        {
            get
            {
                return this.pCT_PERCENTILE_97Field;
            }
            set
            {
                this.pCT_PERCENTILE_97Field = value;
            }
        }

        /// <remarks/>
        [System.Xml.Serialization.XmlIgnoreAttribute()]
        public bool PCT_PERCENTILE_97Specified
        {
            get
            {
                return this.pCT_PERCENTILE_97FieldSpecified;
            }
            set
            {
                this.pCT_PERCENTILE_97FieldSpecified = value;
            }
        }

        /// <remarks/>
        public decimal PCT_PERCENTILE_98
        {
            get
            {
                return this.pCT_PERCENTILE_98Field;
            }
            set
            {
                this.pCT_PERCENTILE_98Field = value;
            }
        }

        /// <remarks/>
        [System.Xml.Serialization.XmlIgnoreAttribute()]
        public bool PCT_PERCENTILE_98Specified
        {
            get
            {
                return this.pCT_PERCENTILE_98FieldSpecified;
            }
            set
            {
                this.pCT_PERCENTILE_98FieldSpecified = value;
            }
        }

        /// <remarks/>
        public decimal PCT_PERCENTILE_99
        {
            get
            {
                return this.pCT_PERCENTILE_99Field;
            }
            set
            {
                this.pCT_PERCENTILE_99Field = value;
            }
        }

        /// <remarks/>
        [System.Xml.Serialization.XmlIgnoreAttribute()]
        public bool PCT_PERCENTILE_99Specified
        {
            get
            {
                return this.pCT_PERCENTILE_99FieldSpecified;
            }
            set
            {
                this.pCT_PERCENTILE_99FieldSpecified = value;
            }
        }
    }

    /// <remarks/>
    [System.Xml.Serialization.XmlTypeAttribute(AnonymousType = true)]
    public partial class RootRegularDataRow
    {

        private string pCT_TYPEField;

        private string pCT_NAMEField;

        private byte pCT_MINIMUMField;

        private byte pCT_MAXIMUMField;

        private decimal pCT_AVERAGEField;

        private decimal pCT_MEDIANField;

        private decimal pCT_STDDEVIATIONField;

        private ushort pCT_SUM1Field;

        private bool pCT_SUM1FieldSpecified;

        /// <remarks/>
        public string PCT_TYPE
        {
            get
            {
                return this.pCT_TYPEField;
            }
            set
            {
                this.pCT_TYPEField = value;
            }
        }

        /// <remarks/>
        public string PCT_NAME
        {
            get
            {
                return this.pCT_NAMEField;
            }
            set
            {
                this.pCT_NAMEField = value;
            }
        }

        /// <remarks/>
        public byte PCT_MINIMUM
        {
            get
            {
                return this.pCT_MINIMUMField;
            }
            set
            {
                this.pCT_MINIMUMField = value;
            }
        }

        /// <remarks/>
        public byte PCT_MAXIMUM
        {
            get
            {
                return this.pCT_MAXIMUMField;
            }
            set
            {
                this.pCT_MAXIMUMField = value;
            }
        }

        /// <remarks/>
        public decimal PCT_AVERAGE
        {
            get
            {
                return this.pCT_AVERAGEField;
            }
            set
            {
                this.pCT_AVERAGEField = value;
            }
        }

        /// <remarks/>
        public decimal PCT_MEDIAN
        {
            get
            {
                return this.pCT_MEDIANField;
            }
            set
            {
                this.pCT_MEDIANField = value;
            }
        }

        /// <remarks/>
        public decimal PCT_STDDEVIATION
        {
            get
            {
                return this.pCT_STDDEVIATIONField;
            }
            set
            {
                this.pCT_STDDEVIATIONField = value;
            }
        }

        /// <remarks/>
        public ushort PCT_SUM1
        {
            get
            {
                return this.pCT_SUM1Field;
            }
            set
            {
                this.pCT_SUM1Field = value;
            }
        }

        /// <remarks/>
        [System.Xml.Serialization.XmlIgnoreAttribute()]
        public bool PCT_SUM1Specified
        {
            get
            {
                return this.pCT_SUM1FieldSpecified;
            }
            set
            {
                this.pCT_SUM1FieldSpecified = value;
            }
        }

    }


}
