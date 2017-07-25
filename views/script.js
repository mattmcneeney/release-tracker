'use strict';

function pad(num, size) {
   var s = num + '';
   while (s.length < size) s = '0' + s;
   return s;
}

let secondsUntilRefresh = 600;
setInterval(function() {
   if (secondsUntilRefresh == 0) {
      location.reload();
      return;
   }
   let mins = Math.floor(secondsUntilRefresh / 60);
   let secs = secondsUntilRefresh - (mins * 60);
   document.getElementById('countdown').innerHTML = mins + ':' + pad(secs, 2);
   secondsUntilRefresh -= 1;
}, 1000);
