function getAndroidVersion(ua) {
    ua = (ua || navigator.userAgent).toLowerCase();
    var match = ua.match(/android\s([0-9\.]*)/);
    return match ? match[1] : false;
};

getAndroidVersion(); //"4.2.1"
parseInt(getAndroidVersion(), 10); //4
console.log(parseFloat(getAndroidVersion())); //4.2
