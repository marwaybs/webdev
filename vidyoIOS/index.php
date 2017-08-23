<?php

$command = escapeshellcmd('python3 generateToken.py --key=rUlaMASgt1Byi4Kp3sKYDeQzo --appID=ApplicationID --userName=user1 --expiresInSecs=10000');
$output = shell_exec($command);
echo $output;

?>
