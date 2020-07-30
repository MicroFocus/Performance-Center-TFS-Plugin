using System;
using System.IO;
using System.Net;
using PC.Plugins.Common.Constants;


namespace PC.Plugins.Common.Client
{
    public class ClientResponse
    {
        public int StatusCode { get; }
        public string StatusDescription { get; }
        public long ContentLength { get; }
        public string ContentType { get; }
        public Uri ResponseUri { get; }
        public Version ProtocolVersion { get; }
        public string Method { get; }
        public WebHeaderCollection Headers { get; }
        public CookieCollection Cookies { get; }
        public string Body { get; }

        public byte[] responseByteArray;

        //private static readonly log4net.ILog log = log4net.LogManager.GetLogger(System.Reflection.MethodBase.GetCurrentMethod().DeclaringType);

        public ClientResponse(HttpWebResponse httpResponse)
        {
            if (httpResponse==null)
            {
                Body = "httpResponse is null";
                return;
                //throw new HttpException("Response cannot be null.");
            }

            StatusCode = (int)httpResponse.StatusCode;
            StatusDescription = httpResponse.StatusDescription;
            ContentLength = httpResponse.ContentLength;
            ResponseUri = httpResponse.ResponseUri;
            ProtocolVersion = httpResponse.ProtocolVersion;
            Method = httpResponse.Method;
            Headers = httpResponse.Headers;
            ContentType = httpResponse.ContentType;
            Cookies = httpResponse.Cookies;
            Body = GetResponseString(httpResponse);
            if (Body != string.Empty)
            {
                //log.DebugFormat("Request Body Response: {0}", Body);
            }
        }

        public ClientResponse(WebException webException)
            : this((HttpWebResponse)webException.Response)
        {
            if (webException != null && (string.IsNullOrEmpty(this.Body) || Body.Equals("httpResponse is null")))
            {
                this.Body += !string.IsNullOrEmpty(webException.Message) ? "\n -WebException Message = " + webException.Message : "";
                this.Body += !string.IsNullOrEmpty(webException.Status.ToString()) ? "\n -WebException Status = " + webException.Status.ToString() : "";
                if(webException.InnerException != null)
                {
                    this.Body += !string.IsNullOrEmpty(webException.InnerException.Message) ? "\n  -WebException InnerException Message = " + webException.InnerException.Message : "";
                }
            }
        }

        private string GetResponseString(WebResponse r)
        {
            using (Stream data = r.GetResponseStream())
            {
                if (data == null)
                {
                    return null;
                }
                if (r.ContentType == RESTConstants.APPLICATION_ZIP)
                {
                    using (MemoryStream ms = new MemoryStream())
                    {
                        r.GetResponseStream().CopyTo(ms);
                        responseByteArray = ms.ToArray();
                    }
                }
                using (var reader = new StreamReader(data))
                {
                    return reader.ReadToEnd();
                }
            }
        }
    }
}
