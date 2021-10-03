self.addEventListener('push', event => {
  console.log(event.data)
  const data = event.data.json()
  console.log('New notification', data)
  const options = {
    body: data.body,
    badge: './badge-92x92.png' ,
    icon: './android-chrome-192x192.png',
  }
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
})
