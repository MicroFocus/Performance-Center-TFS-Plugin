using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Text;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Security.Cryptography.X509Certificates;

using System.Threading.Tasks;


//[assembly: log4net.Config.XmlConfigurator(Watch = true)]

namespace PC.Plugins.Common.Client
{
    public class ClientRequest
    {
        public bool AcceptInvalidSslCerts = true;
        private WebHeaderCollection _headers;
        private string _body;
        private string _contentType;
        private bool _gzipContentEncoding;
        private string _accept;
        private Uri _uri;
        private X509Certificate _clientCert;
        private MultipartFormDataContent content = new MultipartFormDataContent();
        private readonly CookieContainer _cookies;
        private IWebProxy _proxy;
        //private static readonly log4net.ILog log = log4net.LogManager.GetLogger(System.Reflection.MethodBase.GetCurrentMethod().DeclaringType);
        private enum Method
        {
            GET,
            POST,
            PUT,
            DELETE
        }

        public ClientRequest(Uri resource, CookieContainer cookies, IWebProxy proxy)
        {
            _cookies = cookies;
            _uri = resource;
            _proxy = proxy;
        }

        private ClientResponse SendRequest(Method method, string fullFileName = "")
        {
            ServicePointManager.ServerCertificateValidationCallback = new System.Net.Security.RemoteCertificateValidationCallback(AcceptAllCertifications);
            HttpWebRequest httpWebRequest = (HttpWebRequest)WebRequest.Create(_uri);
            httpWebRequest.Timeout = 1000000;
            // log messages
            //log.DebugFormat("Request Type: {0}", method.ToString());
            //log.DebugFormat("Request Headers: {0}, Accept: {1}", _headers, _accept);
            //log.DebugFormat(" Request Url : {0}", _uri);
            if (method == Method.PUT
                || method == Method.POST)
            {
                //log.DebugFormat("Body: {0} ", _body);
                //log.DebugFormat("Content Type: {0}", _contentType);
            }

            if (_headers != null)
            {
                httpWebRequest.Headers = _headers;
            }

            if (_accept != null)
            {
                httpWebRequest.Accept = _accept;
            }
            if (_clientCert != null)
            {
                httpWebRequest.ClientCertificates.Add(_clientCert);
            }

            httpWebRequest.CookieContainer = _cookies;
            httpWebRequest.Method = method.ToString();
            httpWebRequest.ContentType = _contentType;
            httpWebRequest.Proxy = _proxy;

            if (_gzipContentEncoding == true)
            {
                httpWebRequest.AutomaticDecompression = System.Net.DecompressionMethods.GZip;
            }

            if (!string.IsNullOrEmpty(_body))
            {
                ASCIIEncoding encoding = new ASCIIEncoding();
                byte[] byte1 = encoding.GetBytes(_body);

                // Set the content length of the string being posted.
                httpWebRequest.ContentLength = byte1.Length;

                Stream newStream = httpWebRequest.GetRequestStream();

                newStream.Write(byte1, 0, byte1.Length);

                // Close the Stream object.
                newStream.Close();
            }
            else
            {
                httpWebRequest.ContentLength = 0;
            }
            if (string.IsNullOrEmpty(fullFileName))
            {
                try
                {
                    return new ClientResponse((HttpWebResponse)httpWebRequest.GetResponse());
                }
                catch (WebException e)
                {
                    return new ClientResponse(e);
                }
            }
            else
            {
                try
                {
                    try
                    {
                        new Task(() => { DownloadFile(httpWebRequest, fullFileName); }).Start();
                    }
                    catch //(Exception ex)
                    {
                        //log.Error(ex);
                    }
                    Uri newUri = new Uri(_uri.AbsoluteUri.Substring(0, _uri.AbsoluteUri.LastIndexOf('/')));

                    HttpWebRequest httpWebRequestForPing = (HttpWebRequest)WebRequest.Create(newUri);

                    HttpWebRequestDefinition(method, ref httpWebRequestForPing);

                    return new ClientResponse((HttpWebResponse)httpWebRequestForPing.GetResponse());
                }
                catch (WebException e)
                {
                    return new ClientResponse(e);
                }
            }
        }


        private void HttpWebRequestDefinition (Method method, ref HttpWebRequest httpWebRequest)
        {
            httpWebRequest.Timeout = 1000000;
            // log messages
            //log.DebugFormat("Request Type: {0}", method.ToString());
            //log.DebugFormat("Request Headers: {0}, Accept: {1}", _headers, _accept);
            //log.DebugFormat(" Request Url : {0}", _uri);
            if (method == Method.PUT
                || method == Method.POST)
            {
                //log.DebugFormat("Body: {0} ", _body);
                //log.DebugFormat("Content Type: {0}", _contentType);
            }

            if (_headers != null)
            {
                httpWebRequest.Headers = _headers;
            }

            if (_accept != null)
            {
                httpWebRequest.Accept = _accept;
            }
            if (_clientCert != null)
            {
                httpWebRequest.ClientCertificates.Add(_clientCert);
            }

            httpWebRequest.CookieContainer = _cookies;
            httpWebRequest.Method = method.ToString();
            httpWebRequest.ContentType = _contentType;
            httpWebRequest.Proxy = _proxy;

            if (_gzipContentEncoding == true)
            {
                httpWebRequest.AutomaticDecompression = System.Net.DecompressionMethods.GZip;
            }

            if (!string.IsNullOrEmpty(_body))
            {
                ASCIIEncoding encoding = new ASCIIEncoding();
                byte[] byte1 = encoding.GetBytes(_body);

                // Set the content length of the string being posted.
                httpWebRequest.ContentLength = byte1.Length;

                Stream newStream = httpWebRequest.GetRequestStream();

                newStream.Write(byte1, 0, byte1.Length);

                // Close the Stream object.
                newStream.Close();
            }
            else
            {
                httpWebRequest.ContentLength = 0;
            }
        }

        private void DownloadFile(HttpWebRequest httpWebRequest, string destinationPath)
        {
            using (var stream = File.Open(destinationPath, FileMode.Create, FileAccess.Write, FileShare.Read))
            {
                long bytesToReceive = 0;
                long bytesReceived = 0;
                int attempts = 0;
                bool finished = false;

                while (!finished)
                {
                    attempts += 1;

                    if (attempts > 3)
                    {
                        return;
                    }

                    try
                    {
                        if (bytesReceived != 0)
                        {
                            //log.Debug(string.Format("Request resuming with range: {0} , {1}", bytesReceived, bytesToReceive));
                            httpWebRequest.AddRange(bytesReceived, bytesToReceive);
                        }

                        using (var response = httpWebRequest.GetResponse())
                        {                            
                            //log.Debug(string.Format("Received response. ContentLength={0} , ContentType={1}", response.ContentLength, response.ContentType));
                            if (bytesToReceive == 0)
                            {
                                bytesToReceive = response.ContentLength;
                            }

                            using (var responseStream = response.GetResponseStream())
                            {
                                //log.Debug("Beginning read of response stream.");
                                var partition = new byte[4096];
                                int partitionReadenFromResponseStream = responseStream.Read(partition, 0, partition.Length);
                                while (partitionReadenFromResponseStream > 0)
                                {
                                    stream.Write(partition, 0, partitionReadenFromResponseStream);
                                    bytesReceived += partitionReadenFromResponseStream;
                                    partitionReadenFromResponseStream = responseStream.Read(partition, 0, partition.Length);
                                }
                                //log.Debug("Finished read of response stream.");
                            }
                        }

                        //log.Debug("finished");
                        finished = true;
                    }
                    catch //(Exception ex)
                    {
                        //log.Error(ex);
                    }
                }
            }
        }

        private HttpResponseMessage AsyncSendRequest()
        {
            HttpClientHandler handler = new HttpClientHandler();
            foreach (Cookie cookie in _cookies.GetCookies(_uri))
            {
                handler.CookieContainer.Add(_uri, new System.Net.Cookie(cookie.Name, cookie.Value, cookie.Path, cookie.Domain)); // Adding a Cookie

            }

            using (var client = new HttpClient(handler))
            {
                client.BaseAddress = _uri;
                return (HttpResponseMessage)client.PostAsync(string.Empty, content).Result;
            }

        }

        public ClientRequest ContentEncoding(bool encoding)
        {
            _gzipContentEncoding = encoding;
            return this;
        }
        public ClientRequest ContentType(string mediaType)
        {
            _contentType = mediaType;
            return this;
        }

        public ClientRequest Body(string body)
        {
            _body = body;
            return this;
        }

        public ClientRequest ClientCertificate(X509Certificate clientCert)
        {
            _clientCert = clientCert;
            return this;
        }

        public ClientRequest UploadZip(string filePath, string body, string formDataHeader = "form-data")
        {
            ByteArrayContent fileContent1 = new ByteArrayContent(File.ReadAllBytes(filePath));
            fileContent1.Headers.ContentType = new MediaTypeHeaderValue("application/zip");
            fileContent1.Headers.ContentDisposition = new ContentDispositionHeaderValue(formDataHeader)
            {
                FileName = Path.GetFileName(filePath)
            };
            var fileContent2 = new ByteArrayContent(ASCIIEncoding.ASCII.GetBytes(body));
            fileContent2.Headers.ContentDisposition = new ContentDispositionHeaderValue(formDataHeader)
            {
                Name = "test"
            };


            content.Add(fileContent1);
            content.Add(fileContent2);
            return this;
        }

        public ClientRequest Header(string key, string value)
        {
            if (_headers == null)
            {
                _headers = new WebHeaderCollection();
            }
            _headers.Add(key, value);
            return this;
        }

        public ClientRequest Accept(string value)
        {
            if (_accept == null)
            {
                _accept = value;
            }
            return this;
        }

        public ClientRequest Headers(Dictionary<string, string> headers)
        {

            if (_headers == null)
            {
                _headers = new WebHeaderCollection();
            }

            foreach (var header in headers)
            {
                _headers.Add(header.Key, header.Value);
            }
            return this;
        }

        public ClientRequest Cookies(CookieCollection cookies)
        {
            _cookies.Add(cookies);
            return this;
        }

        public ClientRequest Proxy(IWebProxy proxy)
        {
            _proxy = proxy;
            return this;
        }

        public ClientResponse Get() => SendRequest(Method.GET);

        public ClientResponse GetFile(string fullFileName) => SendRequest(Method.GET, fullFileName);

        public HttpResponseMessage PostAsync() => AsyncSendRequest();



        public ClientResponse Post() => SendRequest(Method.POST);

        public ClientResponse Put() => SendRequest(Method.PUT);

        public ClientResponse Delete() => SendRequest(Method.DELETE);

        public bool AcceptAllCertifications(object sender, System.Security.Cryptography.X509Certificates.X509Certificate certification, System.Security.Cryptography.X509Certificates.X509Chain chain, System.Net.Security.SslPolicyErrors sslPolicyErrors) => AcceptInvalidSslCerts;

    }
}