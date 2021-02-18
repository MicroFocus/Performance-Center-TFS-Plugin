using PC.Plugins.Common.Client;
using PC.Plugins.Common.Constants;
using System.Net;

namespace PC.Plugins.Common.Rest
{
    public class RestEntity
    {

        private Client.Client pcClient = new Client.Client();

        public Client.Client PCClient => pcClient;

        public ClientRequest PCClientRequest(string webProtocol, string pcServer, string proxyURL, string proxyUser, string proxyPassword, string domain, string project, string url, string tenant="", bool isLoginOrLogout = false)
        {

            string restUrl;
            if (isLoginOrLogout)
            {
                restUrl = string.Format("{0}://{1}/{2}{3}", webProtocol, pcServer, url, !string.IsNullOrEmpty(tenant) ? "/"+tenant : "");
            }
            else
            {
                restUrl = string.Format("{0}://{1}/LoadTest/rest/domains/{2}/projects/{3}/{4}",
                                webProtocol, pcServer, domain, project, url);
            }
            NetworkCredential proxyCreds = new NetworkCredential();

            if (!string.IsNullOrWhiteSpace(proxyURL) && !string.IsNullOrWhiteSpace(proxyUser))
            {
                proxyCreds = new NetworkCredential(
                    proxyUser,
                    proxyPassword
                    );             
            }

            WebProxy proxy = new WebProxy();

            if (!string.IsNullOrWhiteSpace(proxyURL))
            {
                proxy = new WebProxy(proxyURL, false)
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

