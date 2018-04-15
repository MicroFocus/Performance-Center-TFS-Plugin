using System;
using System.Collections;
using System.IO;
using System.Xml.Serialization;
using System.Xml;
using PC.Plugins.Common.Constants;


namespace PC.Plugins.Common.Helper
{
    class Serializer
    {

        private XmlRootAttribute _serXmlRootAttribute;

        public XmlRootAttribute SerXmlRootAttribute
        {
            get { return _serXmlRootAttribute; }
            set { _serXmlRootAttribute = value; }
        }

        public T Deserialize<T>(string input) where T : class
        {
            System.Xml.Serialization.XmlSerializer ser = new System.Xml.Serialization.XmlSerializer(typeof(T), _serXmlRootAttribute);

            using (StringReader sr = new StringReader(input))
            {
                return (T)ser.Deserialize(sr);
            }
        }

        public string Serialize<T>(T ObjectToSerialize)
        {
            XmlSerializer serializer = new XmlSerializer(ObjectToSerialize.GetType());
            XmlWriterSettings settings = new XmlWriterSettings();
            settings.Indent = true;
            settings.OmitXmlDeclaration = true;

            using (StringWriter stream = new StringWriter())
            using (XmlWriter writer = XmlWriter.Create(stream, settings))
            {
                XmlSerializerNamespaces namepSpaces = new XmlSerializerNamespaces(new[] { XmlQualifiedName.Empty });
                namepSpaces.Add("", PCConstants.PC_API_XMLNS);
                serializer.Serialize(writer, ObjectToSerialize, namepSpaces);
                return stream.ToString();
            }
        }

    }
}
