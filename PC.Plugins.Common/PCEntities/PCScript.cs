using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Xml.Serialization;
using PC.Plugins.Common.Helper;
using PC.Plugins.Common.Constants;
using System.IO;

namespace PC.Plugins.Common.PCEntities
{

    /// <remarks/>
    [System.Xml.Serialization.XmlTypeAttribute(AnonymousType = true, Namespace = PCConstants.PC_API_XMLNS)]
    [System.Xml.Serialization.XmlRootAttribute(Namespace = PCConstants.PC_API_XMLNS, IsNullable = false, ElementName = "Script")]
    public partial class PCScript
    {
        public PCScript()
        {
        }

        public PCScript(string testFolderPathField, bool overwriteField, bool runtimeOnlyField, bool keepCheckedOutField)
        {
            _testFolderPathField = testFolderPathField;
            _overwriteField = overwriteField;
            _runtimeOnlyField = runtimeOnlyField;
            _keepCheckedOutField = keepCheckedOutField;
        }

        private string _testFolderPathField;

        private bool _overwriteField;

        private bool _runtimeOnlyField;

        private bool _keepCheckedOutField;

        /// <remarks> 
        /// The path of the folder within the ALM Test Plan the script will be uploaded to.
        /// </remarks>
        public string TestFolderPath
        {
            get
            {
                return this._testFolderPathField;
            }
            set
            {
                this._testFolderPathField = value;
            }
        }

        /// <remarks> 
        /// Action if script with the same pathname already exists. One of:
        /// true: Overwrite existing script. (default)
        /// false: Automatically rename new script.
        /// </remarks>
        public bool Overwrite
        {
            get
            {
                return this._overwriteField;
            }
            set
            {
                this._overwriteField = value;
            }
        }

        /// <remarks>
        /// One of:
        /// true: Upload only runtime files. (default)
        /// false: Upload all files.
        /// </remarks>
        public bool RuntimeOnly
        {
            get
            {
                return this._runtimeOnlyField;
            }
            set
            {
                this._runtimeOnlyField = value;
            }
        }

        /// <remarks>
        /// Applies if project supports versioning to indicate whether the script needs to be checked in/out after an upload. Use one of:
        /// true: Uploaded script will remain checked-out.
        /// false: Uploaded script is checked in. (default).
        /// Note: If the project does not support version control, this element is meaningless and you can leave the default value("false") or not use the KeepCheckedOut element at all.Do not send an empty element.
        /// </remarks>
        public bool KeepCheckedOut
        {
            get
            {
                return this._keepCheckedOutField;
            }
            set
            {
                this._keepCheckedOutField = value;
            }
        }

        public static PCScript XMLToObject(string xml)
        {
            XmlRootAttribute xRoot = new XmlRootAttribute
            {
                ElementName = "Script",
                IsNullable = true,
                Namespace = PCConstants.PC_API_XMLNS,
            };

            XmlSerializer serializer = new XmlSerializer(typeof(PCScript), xRoot);
            PCScript pcScript;
            using (StringReader reader = new StringReader(xml))
            {
                pcScript = (PCScript)serializer.Deserialize(reader);
            }
            return pcScript;
        }

        //could be problematic for empty values
        public static PCScript XMLToObject2(string xml)
        {
            Serializer serialzer = new Serializer();
            serialzer.SerXmlRootAttribute = new XmlRootAttribute
            {
                ElementName = "Script",
                IsNullable = true,
                Namespace = PCConstants.PC_API_XMLNS,
            };
            return serialzer.Deserialize<PCScript>(xml);
        }

        public string ObjectToXml() => new Serializer().Serialize(this);

    }


}
