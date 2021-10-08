const convertedVapidKey = urlBase64ToUint8Array(process.env.REACT_APP_PUBLIC_VAPID_KEY)

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4)
  // eslint-disable-next-line
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/")

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

function sendSubscription(subscription) {
  return fetch(`${process.env.REACT_APP_BACKEND}/notifications/subscribe`,{
    method:'POST',
    body: JSON.stringify(subscription),
    headers: {
      'Content-Type': 'application/json'
    }
  })
}

export function subscribeUser() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
    .then(registration => {

      if(!registration.pushManager) {
        console.log('Push manager unavailable in browser.')
        return
      } 

      registration.pushManager.getSubscription()
      .then(existedSubscription => {

        if (existedSubscription === null) {

          console.log('No subscription detected, make a request.')
          // create subscription obj, containing details to contact client
          registration.pushManager.subscribe({ 
            applicationServerKey: convertedVapidKey, // TODO: fetch from backend
            userVisibleOnly: true,
          })
          .then(newSubscription => {
            console.log('New subscription added.')
            sendSubscription(newSubscription)
          })
          .catch(e => {
            (Notification.permission !== 'granted') 
            ? console.log('Premission was not granted.')
            : console.error('Error occured in subscription.', e)
          })

        }else{
          
          console.log('Existed subscription detected.')
          sendSubscription(existedSubscription)

        }

      })
      .catch(e => console.error('Error occured during SW registration.', e))

    })
  }
}





