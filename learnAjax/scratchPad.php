<?php
$feelings = "I am a cat";
$command = "sudo python2 sentiment.py \"" .$feelings ."\"";
// echo ($command);
$output = (shell_exec($command));
echo($output);

 ?>
