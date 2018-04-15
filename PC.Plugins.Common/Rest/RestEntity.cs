using System;
using System.Text;
using System.Security.Cryptography;
using PC.Plugins.Common.Client;
using PC.Plugins.Common.Constants;
using System.Net;

namespace PC.Plugins.Common.Rest
{
    public class RestEntity
    {

        private Client.Client pcClient = new Client.Client();

        public Client.Client PCClient => pcClient;

        public ClientRequest PCClientRequest(string webProtocol, string pcServer, string proxyHostName, string proxyPort, string proxyUser, string proxyPassword, string domain, string project, string url, bool isLoginOrLogout = false)
        {

            string restUrl;
            if (isLoginOrLogout)
            {
                restUrl = string.Format("{0}://{1}/{2}", webProtocol, pcServer, url);
            }
            else
            {
                restUrl = string.Format("{0}://{1}/LoadTest/rest/domains/{2}/projects/{3}/{4}",
                                webProtocol, pcServer, domain, project, url);
            }
            string proxyUri = "";
            NetworkCredential proxyCreds = new NetworkCredential();

            if (!string.IsNullOrWhiteSpace(proxyHostName))
            {
                if (!string.IsNullOrWhiteSpace(proxyPort))
                    proxyUri = string.Format("{0}:{1}", proxyHostName, proxyPort);
                else
                    proxyUri = string.Format("{0}", proxyHostName);



                if (!string.IsNullOrWhiteSpace(proxyUser))
                {
                    proxyCreds = new NetworkCredential(
                        proxyUser,
                        proxyPassword
                    );
                }
            }


            WebProxy proxy = new WebProxy();

            if (!string.IsNullOrWhiteSpace(proxyHostName))
            {
                proxy = new WebProxy(proxyUri, false)
                {
                    UseDefaultCredentials = string.IsNullOrWhiteSpace(proxyUser),
                    Credentials = proxyCreds
                };
            }
            ClientRequest clientRequest = PCClient.Request(restUrl)
                .Proxy(proxy)
                .ContentType(RESTConstants.APPLICATION_XML)
                .Header("X-QC-HIDDEN-SECURITY-ID", "12")
                .Accept(RESTConstants.APPLICATION_XML);

            return clientRequest;
        }
    }


}

