<?php

$command = escapeshellcmd('python3 generateToken.py --key=rUlaMASgt1Byi4Kp3sKYDeQzo --appID=ApplicationID --userName=ios --expiresInSecs=10000');
$token = shell_exec($command);
// <a href="inkblottherapy://?token="$token"&resourceId=123&host=123&hideConfig=1">Open ios app</a>

echo "<a href=VidyoConnector://?token='$token'&resourceId=blueHarp&host=prod.vidyo.io&hideConfig=1>Open ios app</a>"

?>
