using System;
using System.Net;

namespace PC.Plugins.Common.Client
{
    public class Client
    {
        private CookieContainer _cookies;
        private IWebProxy _proxy;

        public ClientRequest Request(Uri resource)
        {
            if (_cookies == null)
            {
                _cookies = new CookieContainer();
            }

            return new ClientRequest(resource, _cookies, _proxy);
        }

        public ClientRequest Request(string resource)
        {
            try
            {
                return Request(new Uri(resource));
            }
            catch (UriFormatException e)
            {
                throw new UriFormatException(String.Format("Uri: \"{0}\" cannot be determined.", resource), e);
            }
        }
    }
}
