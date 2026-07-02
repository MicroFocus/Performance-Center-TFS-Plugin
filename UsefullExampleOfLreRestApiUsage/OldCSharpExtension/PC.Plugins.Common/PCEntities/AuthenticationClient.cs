using PC.Plugins.Common.Helper;
using System.IO;
using System.Xml.Serialization;

namespace PC.Plugins.Common.PCEntities
{

    // NOTE: Generated code may require at least .NET Framework 4.5 or .NET Core/Standard 2.0.
    /// <remarks/>
    [System.SerializableAttribute()]
    [System.ComponentModel.DesignerCategoryAttribute("code")]
    [System.Xml.Serialization.XmlTypeAttribute(AnonymousType = true)]
    [System.Xml.Serialization.XmlRootAttribute(Namespace = "", IsNullable = false)]
    public partial class AuthenticationClient
    {
        public AuthenticationClient()
        { }

        public AuthenticationClient(string clientIdKey, string clientSecretKey)
        {
            ClientIdKey = clientIdKey;
            ClientSecretKey = clientSecretKey;
        }

        /// <remarks/>
        [XmlElement("ClientIdKey")]
        public string ClientIdKey { get; set; }
        
        /// <remarks/>
        [XmlElement("ClientSecretKey")]
        public string ClientSecretKey { get; set; }
        
        public static AuthenticationClient XMLToObject(string xml)
        {
            XmlSerializer serializer = new XmlSerializer(typeof(AuthenticationClient));
            AuthenticationClient authenticationClient;
            using (StringReader reader = new StringReader(xml))
            {
                authenticationClient = (AuthenticationClient)serializer.Deserialize(reader);
            }
            return authenticationClient;
        }

        public string ObjectToXml() => new Serializer().Serialize(this);
    }
}

